export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.image || typeof body.image !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "image" in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Safety guard on raw base64 payload size (max 4MB)
    if (body.image.length > 4 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Image payload exceeds 4MB limit' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Retrieve Image Search settings from D1 or environment
    let apiKeys: string[] = [];
    let isEnabled = true;
    let selectedModel = 'models/gemini-embedding-2';

    try {
      const settingsRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'imageSearchSettings'").first();
      if (settingsRow && settingsRow.value) {
        const parsed = JSON.parse(settingsRow.value as string);
        if (Array.isArray(parsed.geminiApiKeys)) {
          apiKeys = parsed.geminiApiKeys.map((k: any) => String(k).trim()).filter(Boolean);
        }
        if (parsed.geminiApiKey) {
          const single = parsed.geminiApiKey.trim();
          if (single && !apiKeys.includes(single)) {
            apiKeys.unshift(single);
          }
        }
        if (parsed.enabled !== undefined) isEnabled = Boolean(parsed.enabled);
        if (parsed.model) selectedModel = parsed.model.trim();
      }
    } catch (e) {}

    if (apiKeys.length === 0 && env.GEMINI_API_KEY) {
      apiKeys.push(env.GEMINI_API_KEY.trim());
    }

    if (apiKeys.length === 0) {
      return new Response(JSON.stringify({ error: 'No Gemini API keys are configured in store dashboard settings.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isEnabled) {
      return new Response(JSON.stringify({ error: 'Visual search is currently disabled by store administrator' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Parse MIME type and clean Base64 data
    let mimeType = 'image/jpeg';
    let cleanBase64 = body.image;

    const dataUriMatch = body.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUriMatch) {
      mimeType = dataUriMatch[1];
      cleanBase64 = dataUriMatch[2];
    } else {
      cleanBase64 = body.image.trim().replace(/^data:image\/[a-z]+;base64,/, '');
    }

    const cleanModel = selectedModel.startsWith('models/') ? selectedModel.replace(/^models\//, '') : selectedModel;
    const isEmbeddingModel = cleanModel.toLowerCase().includes('embedding');

    if (!isEmbeddingModel) {
      // Generative Multimodal Vision Model (e.g., gemini-2.5-flash, gemini-1.5-flash, gemini-3.1-flash-lite)
      const productsRes = await env.DB.prepare('SELECT id, data FROM products LIMIT 600').all();
      const catalog = (productsRes.results || []).map((r: any) => {
        try {
          const p = JSON.parse(r.data);
          if (p.isDeleted || p.isVisible === false) return null;
          return {
            id: String(p.id),
            title: p.title || '',
            category: p.category || ''
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      const promptText = `You are an expert jewelry product matching assistant.
Examine this customer photo and match it against our store catalog:
${JSON.stringify(catalog)}

Return a JSON object with this EXACT structure:
{
  "matchedIds": ["P001"],
  "keywords": "trendy finger ring set"
}
If no single product is an exact match, include the closest visually similar product IDs (maximum 5) or [] if completely unrelated.
IMPORTANT: Return ONLY valid JSON, without backticks, markdown, or extra commentary.`;

      const genPayload = {
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: cleanBase64 } },
            { text: promptText }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
      };

      let genData: any = null;
      let lastGenError = '';
      let keyIndexUsed = -1;

      // Sequential Failover Loop across multiple API keys (Zero Cloudflare looping)
      for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${currentKey}`;

        try {
          const genRes = await fetch(genUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(genPayload)
          });

          if (genRes.ok) {
            genData = await genRes.json();
            keyIndexUsed = i;
            break;
          } else {
            const errText = await genRes.text();
            lastGenError = `Key #${i + 1} (${genRes.status}): ${errText}`;
            console.warn(`[Gemini Failover] Key #${i + 1} failed (${genRes.status}), switching to next key...`);
          }
        } catch (fetchErr: any) {
          lastGenError = `Key #${i + 1} network error: ${fetchErr?.message || fetchErr}`;
          console.warn(`[Gemini Failover] Key #${i + 1} network exception, switching to next key...`);
        }
      }

      if (!genData) {
        return new Response(JSON.stringify({ 
          error: `All ${apiKeys.length} Gemini API keys failed or exhausted quota.`, 
          details: lastGenError 
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const textOutput = genData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let matchedIds: string[] = [];
      let keywords = '';
      try {
        const cleaned = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedJson = JSON.parse(cleaned);
        if (Array.isArray(parsedJson.matchedIds)) matchedIds = parsedJson.matchedIds.map(String);
        if (parsedJson.keywords) keywords = String(parsedJson.keywords);
      } catch {
        const idMatches = textOutput.match(/"matchedIds"\s*:\s*\[(.*?)\]/s);
        if (idMatches && idMatches[1]) {
          try { matchedIds = JSON.parse(`[${idMatches[1]}]`).map(String); } catch {}
        }
      }

      return new Response(JSON.stringify({
        success: true,
        matchedIds,
        matchConfidence: matchedIds.length > 0 ? 'exact' : 'none',
        topScore: matchedIds.length > 0 ? 95 : 0,
        keywords,
        modelUsed: cleanModel,
        keyIndexUsed: keyIndexUsed + 1,
        totalKeysInPool: apiKeys.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Generate Multimodal Vector Embedding using selected embedding model
    const geminiPayload = {
      content: {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: cleanBase64
            }
          }
        ]
      },
      outputDimensionality: 512
    };

    let geminiData: any = null;
    let lastEmbedError = '';
    let keyIndexUsed = -1;

    // Sequential Failover Loop across multiple API keys (Zero Cloudflare looping)
    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:embedContent?key=${currentKey}`;

      try {
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          keyIndexUsed = i;
          break;
        } else {
          const errText = await geminiRes.text();
          lastEmbedError = `Key #${i + 1} (${geminiRes.status}): ${errText}`;
          console.warn(`[Gemini Failover] Embedding Key #${i + 1} failed (${geminiRes.status}), switching to next key...`);
        }
      } catch (fetchErr: any) {
        lastEmbedError = `Key #${i + 1} network error: ${fetchErr?.message || fetchErr}`;
        console.warn(`[Gemini Failover] Embedding Key #${i + 1} network exception, switching to next key...`);
      }
    }

    if (!geminiData) {
      console.error('All Gemini API keys failed in embedding pool:', lastEmbedError);
      return new Response(JSON.stringify({ 
        error: `All ${apiKeys.length} Gemini API keys failed or exhausted daily quota limit.`, 
        details: lastEmbedError 
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const queryVec: number[] = geminiData?.embedding?.values || [];

    if (!queryVec || queryVec.length !== 512) {
      return new Response(JSON.stringify({ error: 'Failed to extract visual embedding from image' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Query Cloudflare Vectorize directly (Sub-15ms native HNSW search, ZERO D1 vector reads)
    let matchedIds: string[] = [];
    let matchConfidence: 'exact' | 'similar' | 'none' = 'none';
    let topScore = 0;
    let topTitle = '';

    if (!env.VECTORIZE) {
      return new Response(JSON.stringify({ error: 'Cloudflare Vectorize binding is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const vectorizeResults = await env.VECTORIZE.query(queryVec, {
      topK: 10,
      returnMetadata: "indexed"
    });

    const matches = vectorizeResults?.matches || [];
    if (matches.length > 0) {
      const topMatch = matches[0];
      topScore = topMatch.score ? Math.round(topMatch.score * 100) : 0;

      // Calibrated accuracy thresholds for e-commerce visual search (studio + real customer photos):
      if (topMatch.score >= 0.65) {
        matchConfidence = topMatch.score >= 0.82 ? 'exact' : 'similar';
        const threshold = Math.max(0.65, topMatch.score - 0.08);
        matchedIds = matches
          .filter((m: any) => m.score >= threshold)
          .slice(0, 5)
          .map((m: any) => String(m.id));

        if (topMatch.metadata?.title) {
          topTitle = String(topMatch.metadata.title);
        }
      }
    }

    // Fallback: If title wasn't indexed in Vectorize metadata, read single row from D1 products table
    if (!topTitle && matchedIds.length > 0) {
      try {
        const topRow = await env.DB.prepare('SELECT json_extract(data, \'$.title\') as title FROM products WHERE id = ?').bind(matchedIds[0]).first();
        if (topRow && topRow.title) {
          topTitle = String(topRow.title);
        }
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      matchedIds,
      matchConfidence,
      topScore,
      keywords: topTitle,
      modelUsed: cleanModel,
      keyIndexUsed: keyIndexUsed + 1,
      totalKeysInPool: apiKeys.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('search_by_image unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

import defaultEmbeddings from './visual_embeddings.json';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

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
    let apiKey = env.GEMINI_API_KEY || '';
    let isEnabled = true;

    try {
      const settingsRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'imageSearchSettings'").first();
      if (settingsRow && settingsRow.value) {
        const parsed = JSON.parse(settingsRow.value as string);
        if (parsed.geminiApiKey) apiKey = parsed.geminiApiKey.trim();
        if (parsed.enabled !== undefined) isEnabled = Boolean(parsed.enabled);
      }
    } catch (e) {}

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is not configured in store dashboard settings.' }), {
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

    // 3. Generate Multimodal Vector Embedding using Google Gemini Embedding 2
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;

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

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini Embedding API Error:', geminiRes.status, errText);
      return new Response(JSON.stringify({ 
        error: 'Vision AI analysis failed. Please verify your Gemini API key.', 
        details: errText 
      }), {
        status: geminiRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geminiData = await geminiRes.json();
    const queryVec: number[] = geminiData?.embedding?.values || [];

    if (!queryVec || queryVec.length !== 512) {
      return new Response(JSON.stringify({ error: 'Failed to extract visual embedding from image' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Load catalog embeddings (pre-compiled index + dynamic D1 additions)
    const catalogEmbeddings: Record<string, number[]> = { ...(defaultEmbeddings as Record<string, number[]>) };

    try {
      const dbRows = await env.DB.prepare('SELECT id, embedding FROM product_embeddings').all();
      if (dbRows && dbRows.results) {
        for (const row of dbRows.results) {
          try {
            catalogEmbeddings[row.id] = JSON.parse(row.embedding);
          } catch {}
        }
      }
    } catch (e) {}

    // 5. Compute Cosine Similarity against all catalog products
    const scores = Object.keys(catalogEmbeddings).map((id) => {
      return {
        id,
        score: cosineSimilarity(queryVec, catalogEmbeddings[id])
      };
    });

    // Sort descending by highest visual similarity
    scores.sort((a, b) => b.score - a.score);

    const topMatch = scores[0];
    let matchedIds: string[] = [];
    let matchConfidence: 'exact' | 'similar' | 'none' = 'none';

    // Strict accuracy thresholds to eliminate random hallucinated matches:
    // If top match score is below 0.75, it's not a match for our catalog
    if (topMatch && topMatch.score >= 0.75) {
      matchConfidence = topMatch.score >= 0.85 ? 'exact' : 'similar';
      // Only include items within 0.08 similarity distance from the top match, max 5 items
      const threshold = Math.max(0.75, topMatch.score - 0.08);
      matchedIds = scores
        .filter(s => s.score >= threshold)
        .slice(0, 5)
        .map(s => s.id);
    }

    // 6. Retrieve top matched product title for clean context
    let topTitle = '';
    if (matchedIds.length > 0) {
      try {
        const topRow = await env.DB.prepare('SELECT data FROM products WHERE id = ?').bind(matchedIds[0]).first();
        if (topRow && topRow.data) {
          const parsed = JSON.parse(topRow.data as string);
          topTitle = parsed.title || '';
        }
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      matchedIds,
      matchConfidence,
      topScore: topMatch ? Math.round(topMatch.score * 100) : 0,
      keywords: topTitle
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

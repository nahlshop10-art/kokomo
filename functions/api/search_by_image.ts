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
      // Normalize if raw base64 was sent
      cleanBase64 = body.image.trim().replace(/^data:image\/[a-z]+;base64,/, '');
    }

    // 3. Load active products catalog from D1 (id, title, category, material, colors)
    const productsRes = await env.DB.prepare('SELECT id, data FROM products LIMIT 600').all();
    const catalog = (productsRes.results || []).map((r: any) => {
      try {
        const p = JSON.parse(r.data);
        if (p.isDeleted || p.isVisible === false) return null;
        return {
          id: String(p.id),
          title: p.title || '',
          category: p.category || '',
          material: p.material || undefined,
          colors: Array.isArray(p.colors) ? p.colors.map((c: any) => typeof c === 'string' ? c : c?.name).filter(Boolean).slice(0, 4) : undefined
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    // 4. Prompt Gemini 3.5 Flash Lite
    const promptText = `You are an expert jewelry product matching assistant for our online store.
Examine this customer photo and match it against our store catalog:
${JSON.stringify(catalog)}

Instructions:
1. Identify the jewelry item in the photo: category (ring, earring, necklace, bracelet, anklet), color (gold, silver, rose gold), design motifs (flower, pearl, geometric, chunky, textured, stone color, multi-piece set).
2. Find the best matching product(s) from our catalog that correspond to this item.
3. Return a JSON object with this EXACT structure:
{
  "matchedIds": ["P001"],
  "keywords": "chunky gold hoop earrings",
  "category": "Earring"
}
If no single product is an exact match, include the closest visually similar product IDs in "matchedIds" and describe the item in "keywords".
IMPORTANT: Return ONLY valid JSON, without any markdown formatting, backticks, or explanatory text.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: cleanBase64
            }
          },
          {
            text: promptText
          }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 250
      }
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API Error:', geminiRes.status, errText);
      return new Response(JSON.stringify({ 
        error: 'Vision AI analysis failed. Please verify your Gemini API key.', 
        details: errText 
      }), {
        status: geminiRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geminiData = await geminiRes.json();
    const candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean JSON response (strip any ```json fences if model added them)
    let parsedResult = { matchedIds: [], keywords: '', category: '' };
    try {
      const cleaned = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleaned);
    } catch (e) {
      // Fallback regex extraction if json parsing fails
      const idMatches = candidateText.match(/"matchedIds"\s*:\s*\[(.*?)\]/s);
      if (idMatches && idMatches[1]) {
        try {
          parsedResult.matchedIds = JSON.parse(`[${idMatches[1]}]`);
        } catch {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      matchedIds: Array.isArray(parsedResult.matchedIds) ? parsedResult.matchedIds : [],
      keywords: parsedResult.keywords || '',
      category: parsedResult.category || ''
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

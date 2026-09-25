import defaultEmbeddings from './visual_embeddings.json';
import { getOriginBase } from './_domain';

export async function getGeminiApiKeys(env: any): Promise<string[]> {
  let apiKeys: string[] = [];
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'imageSearchSettings'").first();
    if (row && row.value) {
      const parsed = JSON.parse(row.value as string);
      if (Array.isArray(parsed.geminiApiKeys)) {
        apiKeys = parsed.geminiApiKeys.map((k: any) => String(k).trim()).filter(Boolean);
      }
      if (parsed.geminiApiKey) {
        const single = parsed.geminiApiKey.trim();
        if (single && !apiKeys.includes(single)) {
          apiKeys.unshift(single);
        }
      }
    }
  } catch (e) {}

  if (apiKeys.length === 0 && env.GEMINI_API_KEY) {
    apiKeys.push(env.GEMINI_API_KEY.trim());
  }
  return apiKeys;
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

export async function indexSingleProduct(
  env: any,
  product: { id: string; image?: string; title?: string }
): Promise<{ success: boolean; id: string; error?: string }> {
  if (!product || !product.id) return { success: false, id: '', error: 'Missing product ID' };

  let rawImage = product.image;
  if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
    try {
      const row = await env.DB.prepare('SELECT data FROM products WHERE id = ?').bind(product.id).first();
      if (row && row.data) {
        const parsed = JSON.parse(row.data as string);
        rawImage = parsed.image || (Array.isArray(parsed.images) ? parsed.images[0] : '');
      }
    } catch (e) {}
  }

  if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
    return { success: false, id: product.id, error: 'Product has no valid image' };
  }

  const apiKeys = await getGeminiApiKeys(env);
  if (apiKeys.length === 0) {
    return { success: false, id: product.id, error: 'No Gemini API keys configured in dashboard settings' };
  }

  // 1. Fetch image buffer (from R2 directly if key matches, or via HTTP fetch)
  let imageBuffer: ArrayBuffer | null = null;
  let mimeType = 'image/jpeg';

  const r2KeyMatch = rawImage.match(/(uploads\/.*)$/);
  if (r2KeyMatch && env.BUCKET) {
    try {
      const r2Obj = await env.BUCKET.get(r2KeyMatch[1]);
      if (r2Obj) {
        imageBuffer = await r2Obj.arrayBuffer();
        if (r2Obj.httpMetadata?.contentType) {
          mimeType = r2Obj.httpMetadata.contentType;
        }
      }
    } catch (e) {}
  }

  if (!imageBuffer) {
    let fullUrl = rawImage;
    if (fullUrl.startsWith('/')) {
      const originBase = getOriginBase(env, 'https://kokomo-1r0.pages.dev');
      fullUrl = originBase + fullUrl;
    }
    try {
      const imgRes = await fetch(fullUrl);
      if (imgRes.ok) {
        imageBuffer = await imgRes.arrayBuffer();
        const ct = imgRes.headers.get('content-type');
        if (ct) mimeType = ct.split(';')[0].trim();
      }
    } catch (err: any) {
      return { success: false, id: product.id, error: `Failed to fetch image: ${err.message}` };
    }
  }

  if (!imageBuffer || imageBuffer.byteLength === 0) {
    return { success: false, id: product.id, error: 'Empty or inaccessible image' };
  }

  const base64Data = bufferToBase64(imageBuffer);

  // 2. Call Gemini Embedding 2 with sequential failover across all keys in pool
  const geminiPayload = {
    content: {
      parts: [
        {
          inline_data: {
            mime_type: mimeType || 'image/jpeg',
            data: base64Data
          }
        }
      ]
    },
    outputDimensionality: 512
  };

  let embeddingVec: number[] | null = null;
  let lastError = '';

  for (let i = 0; i < apiKeys.length; i++) {
    const currentKey = apiKeys[i];
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${currentKey}`;

    try {
      const gRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });

      if (gRes.ok) {
        const gData = (await gRes.json()) as any;
        if (gData?.embedding?.values && gData.embedding.values.length === 512) {
          embeddingVec = gData.embedding.values;
          break;
        }
      } else {
        const errText = await gRes.text();
        lastError = `Key #${i + 1} (${gRes.status}): ${errText}`;
        console.warn(`[VisualIndexer] Key #${i + 1} failed (${gRes.status}), failing over...`);
      }
    } catch (fetchErr: any) {
      lastError = `Key #${i + 1} network error: ${fetchErr?.message || fetchErr}`;
      console.warn(`[VisualIndexer] Key #${i + 1} network exception, failing over...`);
    }
  }

  if (!embeddingVec) {
    return { success: false, id: product.id, error: lastError || 'Failed to generate visual embedding' };
  }

  // 3. Save into D1 product_embeddings table
  await env.DB.prepare(
    'INSERT INTO product_embeddings (id, embedding, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET embedding = excluded.embedding, updated_at = CURRENT_TIMESTAMP'
  ).bind(product.id, JSON.stringify(embeddingVec)).run();

  return { success: true, id: product.id };
}

export async function getVisualIndexStatus(env: any) {
  const staticIndex = defaultEmbeddings as Record<string, number[]>;
  const staticIds = new Set(Object.keys(staticIndex));

  // 1. Fetch all active products
  const productsRes = await env.DB.prepare('SELECT id, data FROM products').all();
  const allActiveProducts: { id: string; title: string; image: string }[] = [];
  for (const row of productsRes.results || []) {
    try {
      const p = JSON.parse(row.data);
      if (p.isDeleted || p.isVisible === false) continue;
      if (p.id) {
        allActiveProducts.push({
          id: String(p.id),
          title: p.title || '',
          image: p.image || (Array.isArray(p.images) ? p.images[0] : '') || ''
        });
      }
    } catch {}
  }

  // 2. Fetch all dynamic indexed IDs from D1
  const d1Rows = await env.DB.prepare('SELECT id FROM product_embeddings').all();
  const d1Ids = new Set((d1Rows.results || []).map((r: any) => String(r.id)));

  // 3. Compute missing products (those with images that have no embedding in static or D1)
  const missingProducts = allActiveProducts.filter(
    (p) => !staticIds.has(p.id) && !d1Ids.has(p.id) && Boolean(p.image)
  );

  const allIndexedUniqueIds = new Set([...staticIds, ...d1Ids]);
  const indexedActiveCount = allActiveProducts.filter((p) => allIndexedUniqueIds.has(p.id)).length;

  return {
    totalActiveProducts: allActiveProducts.length,
    indexedCount: indexedActiveCount,
    missingCount: missingProducts.length,
    missingProducts
  };
}

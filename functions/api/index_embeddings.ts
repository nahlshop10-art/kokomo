import { getVisualIndexStatus, indexSingleProduct } from './_visual_indexer';

export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const status = await getVisualIndexStatus(env);
    return new Response(JSON.stringify({ success: true, ...status }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'index_missing';

    if (action === 'status') {
      const status = await getVisualIndexStatus(env);
      return new Response(JSON.stringify({ success: true, ...status }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    if (action === 'index_product') {
      const productId = body.productId || body.id;
      const imageUrl = body.imageUrl || body.image;
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const res = await indexSingleProduct(env, { id: String(productId), image: imageUrl });
      if (!res.success) {
        return new Response(JSON.stringify({ error: res.error || 'Failed to index product' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, id: productId }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'index_missing') {
      const status = await getVisualIndexStatus(env);
      const toIndex = status.missingProducts || [];
      const newlyIndexed: string[] = [];
      const errors: { id: string; error: string }[] = [];

      for (const p of toIndex) {
        const res = await indexSingleProduct(env, p);
        if (res.success) {
          newlyIndexed.push(p.id);
        } else {
          errors.push({ id: p.id, error: res.error || 'Unknown error' });
        }
        // Small pause between items
        await new Promise(r => setTimeout(r, 200));
      }

      const updatedStatus = await getVisualIndexStatus(env);

      return new Response(JSON.stringify({
        success: true,
        indexedCount: newlyIndexed.length,
        newlyIndexed,
        errors,
        ...updatedStatus
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

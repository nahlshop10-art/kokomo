export async function onRequestPost({ request, env }: any) {
  try {
    const { action, items } = await request.json();
    
    if (!items || !Array.isArray(items)) {
      return new Response('Invalid items', { status: 400 });
    }

    if (action === 'upsert' || action === 'sync_all') {
      const stmts = items.map((item: any) => {
        return env.DB.prepare('INSERT OR REPLACE INTO customers (id, data) VALUES (?, ?)')
                     .bind(item.id, JSON.stringify(item));
      });
      for (let i = 0; i < stmts.length; i += 50) {
        await env.DB.batch(stmts.slice(i, i + 50));
      }
    } else if (action === 'delete') {
      // Customer CRM data is strictly protected and permanent; deletion is rejected.
      return Response.json({ success: true, message: 'Customer CRM records are permanently protected and cannot be deleted.' });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

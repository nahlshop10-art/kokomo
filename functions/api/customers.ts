export async function onRequestGet(context: any) {
  if (!context.data?.isOwner) {
    return new Response(JSON.stringify({ error: 'Forbidden: Only the Owner account can access Customer CRM.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const { env } = context;
  try {
    const customersRes = await env.DB.prepare('SELECT data FROM customers ORDER BY updated_at DESC LIMIT 2000').all();
    const customers = customersRes.results.map((r: any) => JSON.parse(r.data));
    return Response.json({ success: true, customers });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  if (!context.data?.isOwner) {
    return new Response(JSON.stringify({ error: 'Forbidden: Only the Owner account can access Customer CRM.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const { request, env } = context;
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

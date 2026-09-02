import { replaceUploadUrls } from './_domain';
export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const productsRes = await env.DB.prepare('SELECT id, data FROM products LIMIT 5000').all();
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const customersRes = await env.DB.prepare('SELECT data FROM customers ORDER BY updated_at DESC LIMIT 2000').all();
    const allSettingsRes = await env.DB.prepare('SELECT key, value FROM settings').all();

    // Standard orders are now fetched via paginated /api/admin_orders.ts!
    const orders: any[] = [];
        
    const incompleteOrdersRes = await env.DB.prepare("SELECT data FROM orders WHERE type = 'incomplete' ORDER BY cast(id as integer) DESC LIMIT 1000").all();
    const incompleteOrders = incompleteOrdersRes.results.map((r: any) => JSON.parse(r.data));

    const products = productsRes.results.map((r: any) => JSON.parse(r.data));
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : null;
    const customers = customersRes.results.map((r: any) => JSON.parse(r.data));
    
    const settings: Record<string, any> = {};
    for (const r of allSettingsRes.results) {
       settings[r.key] = JSON.parse(r.value);
    }

    let responseBody = JSON.stringify({
      products,
      orders,
      incompleteOrders,
      adminUsers,
      customers,
      settings
    });
    
    responseBody = replaceUploadUrls(responseBody, env);

    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

import { replaceUploadUrls } from './_domain';

function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.trim();
  if (digits.length <= 6) return '****';
  return digits.slice(0, 4) + '****' + digits.slice(-3);
}

function sanitizePublicOrder(order: any): any {
  if (!order) return order;
  const safe = { ...order };
  if (safe.userInfo) {
    safe.userInfo = {
      ...safe.userInfo,
      phone: maskPhone(safe.userInfo.phone)
    };
  }
  if (safe.clientInfo) {
    safe.clientInfo = {
      ...safe.clientInfo,
      phone: maskPhone(safe.clientInfo.phone)
    };
  }
  delete safe.adminNotes;
  delete safe.cost;
  delete safe.profit;
  return safe;
}

export async function onRequestPost({ request, env }: any) {
  try {
    const data = await request.json();
    const { orderIds } = data;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return Response.json({ orders: [] });
    }

    // Cap batch size to prevent bulk database scraping
    const cleanIds = Array.from(new Set(orderIds.map(id => String(id)))).slice(0, 25);

    const ordersRes = await env.DB.prepare(`
        SELECT o.id, o.data 
        FROM orders o 
        JOIN json_each(?) j ON o.id = j.value
        WHERE o.type = 'standard'
    `).bind(JSON.stringify(cleanIds)).all();

    const orders = (ordersRes.results || []).map((r: any) => {
      try {
        return sanitizePublicOrder(JSON.parse(r.data));
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    let responseBody = JSON.stringify({ orders });
    responseBody = replaceUploadUrls(responseBody, env);
    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}


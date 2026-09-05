function normalizePhone(phone: any): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('880') && cleaned.length >= 13) {
    return cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    return cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '0' + cleaned;
  }
  return cleaned;
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const order = await request.json();

    if (!order || !order.phone) {
      return new Response(JSON.stringify({ error: 'Phone number is required' }), { status: 400 });
    }

    const normPhone = normalizePhone(order.phone);
    if (!normPhone || !/^01[3-9]\d{8}$/.test(normPhone)) {
      return new Response(JSON.stringify({ error: 'Invalid Bangladeshi phone number' }), { status: 400 });
    }

    // Deterministic ID based on normalized phone
    const orderId = `inc_${normPhone}`;

    // Never resurrect an incomplete order if a standard order was recently placed for this phone
    const recentStandard = await env.DB.prepare(`
      SELECT id FROM orders 
      WHERE type = 'standard' 
        AND (
          json_extract(data, '$.userInfo.phone') = ? 
          OR json_extract(data, '$.userInfo.phone') = ?
          OR json_extract(data, '$.userInfo.phone') = ?
          OR json_extract(data, '$.userInfo.phone') = ?
        )
        AND datetime(updated_at) >= datetime('now', '-5 minutes')
      LIMIT 1
    `).bind(normPhone, order.phone, '+88' + normPhone, '88' + normPhone).first();

    if (recentStandard) {
      return Response.json({ success: true, message: 'Order already completed', ignored: true });
    }

    // Check for existing incomplete order to preserve admin notes and contacted status
    const existing = await env.DB.prepare(`
      SELECT data FROM orders WHERE id = ? AND type = 'incomplete'
    `).bind(orderId).first();

    let mergedOrder: any = {
      ...order,
      id: orderId,
      normPhone: normPhone
    };

    if (existing && existing.data) {
      try {
        const existingData = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data;
        mergedOrder = {
          ...existingData,
          ...order,
          id: orderId,
          normPhone: normPhone,
          name: (order.name && String(order.name).trim()) || existingData.name || '',
          location: (order.location && String(order.location).trim()) || existingData.location || '',
          cartItems: (order.cartItems && Array.isArray(order.cartItems) && order.cartItems.length > 0) ? order.cartItems : (existingData.cartItems || []),
          // Preserve admin notes & contacted status
          contacted: existingData.contacted !== undefined ? existingData.contacted : (order.contacted ?? false),
          contactedAt: existingData.contactedAt || order.contactedAt,
          adminNotes: existingData.adminNotes || order.adminNotes,
          notes: existingData.notes || order.notes,
          createdAt: existingData.createdAt || existingData.timestamp || order.timestamp || Date.now(),
          updatedAt: Date.now()
        };
      } catch (e) {
        console.error('Failed to parse existing incomplete order:', e);
      }
    } else {
      mergedOrder.createdAt = order.timestamp || Date.now();
      mergedOrder.updatedAt = Date.now();
      if (mergedOrder.contacted === undefined) mergedOrder.contacted = false;
    }

    // Insert or update incomplete order with deterministic key
    await env.DB.prepare(`
      INSERT INTO orders (id, type, data, updated_at) 
      VALUES (?, 'incomplete', ?, CURRENT_TIMESTAMP) 
      ON CONFLICT(id) DO UPDATE SET 
        data = excluded.data, 
        updated_at = CURRENT_TIMESTAMP
    `).bind(orderId, JSON.stringify(mergedOrder)).run();

    return Response.json({ success: true, order: mergedOrder });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

import { replaceUploadUrls } from './_domain';

export async function onRequestGet(context: any) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || 'All';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    // Calculate Analytics over the DATE RANGE using SQL json_extract
    let statsQuery = `
      SELECT 
        json_extract(data, '$.status') as status, 
        json_extract(data, '$.date') as date, 
        json_extract(data, '$.subtotal') as subtotal, 
        json_extract(data, '$.discount') as discount, 
        json_extract(data, '$.profit') as profit, 
        json_extract(data, '$.returnCost') as returnCost,
        json_extract(data, '$.extraCosts') as extraCosts,
        json_extract(data, '$.items') as items
      FROM orders WHERE type = 'standard'
    `;
    const statsParams: any[] = [];
    
    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;
    
    if (start && end) {
       const startStr = start.toISOString().replace('T', ' ').substring(0, 19);
       const endStr = end.toISOString().replace('T', ' ').substring(0, 19);
       statsQuery += ` AND updated_at >= ? AND updated_at <= ?`;
       statsParams.push(startStr, endStr);
    }
    
    const statsRes = await env.DB.prepare(statsQuery).bind(...statsParams).all();

    let stats = {
      totalOrders: 0,
      completedOrders: 0,
      canceledOrders: 0,
      totalSellAmount: 0,
      completedSellAmount: 0,
      totalProfitAmount: 0,
      completedProfitAmount: 0,
      totalReturnedCost: 0,
      totalQuantity: 0,
      uniqueItemIds: [] as string[],
      productSales: {} as Record<string, number>,
      salesData: {} as Record<string, { total: number, profit: number, count: number }>
    };

    for (const o of statsRes.results) {
       const datePart = o.date ? String(o.date).split(', ')[1] : null;
       let orderDate = null;
       if (datePart) {
          const [month, day, year] = datePart.split('/');
          orderDate = new Date(Number(year), Number(month) - 1, Number(day));
       }

       if (start && end && orderDate) {
          if (orderDate < start || orderDate > end) {
             continue; // outside range
          }
       }

       stats.totalOrders++;
       if (o.status === 'Completed') stats.completedOrders++;
       if (o.status === 'Canceled') stats.canceledOrders++;
       
       let subtotal = (Number(o.subtotal) || 0) - (Number(o.discount) || 0);
       stats.totalSellAmount += subtotal;
       if (o.status === 'Completed') stats.completedSellAmount += subtotal;
       
       let profit = o.profit !== null ? Number(o.profit) : undefined;
       if (profit === undefined) {
          let orderCost = 0;
          if (o.items) {
             try {
                const items = JSON.parse(String(o.items));
                orderCost = items.reduce((cost: number, item: any) => cost + ((item.variantBuyPrice ?? (item.product?.buyPrice || Math.floor((item.variantPrice ?? item.product?.price) * 0.4))) * item.quantity), 0);
             } catch(e) {}
          }
          profit = subtotal - orderCost - (Number(o.extraCosts) || 0) - (Number(o.returnCost) || 0);
       }
       stats.totalProfitAmount += profit;
       if (o.status === 'Completed') stats.completedProfitAmount += profit;
       
       if (o.returnCost && Number(o.returnCost) > 0) {
          stats.totalReturnedCost += Number(o.returnCost);
       }
       
       if (o.items) {
          try {
             const items = JSON.parse(String(o.items));
             if (Array.isArray(items)) {
                 items.forEach((item: any) => {
                     stats.totalQuantity += item.quantity || 1;
                     if (item.product && item.product.id) {
                         if (!stats.uniqueItemIds.includes(item.product.id)) {
                             stats.uniqueItemIds.push(item.product.id);
                         }
                         if (o.status !== 'Canceled' && o.status !== 'Returned' && o.status !== 'Complete Return') {
                             stats.productSales[item.product.id] = (stats.productSales[item.product.id] || 0) + (item.quantity || 1);
                         }
                     }
                 });
             }
          } catch(e) {}
       }
       
       // Group for salesData
       if (datePart) {
           const [month, day, year] = datePart.split('/');
           const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
           if (!stats.salesData[formattedDate]) {
              stats.salesData[formattedDate] = { total: 0, profit: 0, count: 0 };
           }
           stats.salesData[formattedDate].total += subtotal;
           stats.salesData[formattedDate].profit += profit;
           stats.salesData[formattedDate].count += 1;
       }
    }

    // Now filter for the Orders List directly in SQL
    let listQuery = `SELECT data FROM orders WHERE type = 'standard' AND (json_extract(data, '$.isDeleted') IS NULL OR json_extract(data, '$.isDeleted') != 1)`;
    const params: any[] = [];

    if (search) {
      const cleanSearch = search.replace(/#/g, '');
      listQuery += ` AND (json_extract(data, '$.id') LIKE ? OR json_extract(data, '$.userInfo.phone') LIKE ? OR json_extract(data, '$.userInfo.name') LIKE ?)`;
      params.push(`%${cleanSearch}%`, `%${search}%`, `%${search}%`);
    }

    if (statusFilter !== 'All') {
      listQuery += ` AND json_extract(data, '$.status') = ?`;
      params.push(statusFilter);
    }

    // First get total count
    const countQuery = listQuery.replace('SELECT data FROM orders', 'SELECT COUNT(*) as total FROM orders');
    const countRes = await env.DB.prepare(countQuery).bind(...params).first();
    const totalFiltered = countRes ? countRes.total : 0;

    // Then get paginated records
    // We sort by id descending (which roughly correlates to date) or we can sort by date, but sorting by id is faster
    // We will extract date for sorting if needed, but ID is a good proxy since IDs are generated sequentially or randomly (actually randomly, wait. In checkout it generates Math.max + 1). So ID descending works.
    listQuery += ` ORDER BY cast(id as integer) DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);

    const paginatedOrdersRes = await env.DB.prepare(listQuery).bind(...params).all();
    const paginatedOrders = paginatedOrdersRes.results.map((r: any) => JSON.parse(r.data));

    let responseBody = JSON.stringify({
        orders: paginatedOrders,
        totalCount: totalFiltered,
        stats 
     });
    
    responseBody = replaceUploadUrls(responseBody, env);
    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

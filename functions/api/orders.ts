export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { items, type, action } = data; // type: 'standard' | 'incomplete', action: 'upsert' | 'delete'
    
    if (!items || !Array.isArray(items) || !type) {
      return new Response('Invalid payload', { status: 400 });
    }

    if (action === 'delete') {
      // High-security check: Only Owner account can delete standard orders
      if (type === 'standard' && !context.data?.isOwner) {
        return new Response(JSON.stringify({ error: 'Forbidden: Only the Owner account can delete orders.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }

      const ids = items.map((i: any) => String(i.id || i)).filter(Boolean);
      if (ids.length > 0) {
        const r2KeysToDelete: string[] = [];
        let softDeletedCount = 0;
        let hardDeletedCount = 0;

        for (const id of ids) {
          const orderRow = await env.DB.prepare('SELECT id, type, data FROM orders WHERE id = ? AND type = ?').bind(id, type).first();
          if (!orderRow) continue;

          let orderData: any = {};
          try {
            orderData = JSON.parse(orderRow.data);
          } catch (e) {}

          const orderItems = orderData.items || orderData.cartItems || [];
          const orderKeys: string[] = [];
          const productIds: string[] = [];

          for (const item of orderItems) {
            const pId = item.product?.id || item.id;
            if (pId) productIds.push(String(pId));
            const urls = [
              item.product?.image,
              ...(Array.isArray(item.product?.images) ? item.product.images : []),
              item.product?.thumbnail
            ];
            for (const u of urls) {
              const m = String(u || '').match(/(uploads\/.*)$/);
              if (m) orderKeys.push(m[1]);
            }
          }

          // Check if any product or image from this order is actively used elsewhere in dashboard:
          // 1. In active products
          // 2. In other active orders
          let isUsedElsewhere = false;

          for (const pId of productIds) {
            const activeProd = await env.DB.prepare(
              "SELECT id FROM products WHERE id = ? AND (json_extract(data, '$.isDeleted') IS NULL OR json_extract(data, '$.isDeleted') != 1) LIMIT 1"
            ).bind(pId).first();
            if (activeProd) {
              isUsedElsewhere = true;
              break;
            }
          }

          if (!isUsedElsewhere) {
            for (const key of orderKeys) {
              const keyPattern = `%${key}%`;
              const prodWithImg = await env.DB.prepare(
                "SELECT id FROM products WHERE (json_extract(data, '$.isDeleted') IS NULL OR json_extract(data, '$.isDeleted') != 1) AND data LIKE ? LIMIT 1"
              ).bind(keyPattern).first();
              if (prodWithImg) {
                isUsedElsewhere = true;
                break;
              }
              const otherOrder = await env.DB.prepare(
                "SELECT id FROM orders WHERE id != ? AND (json_extract(data, '$.isDeleted') IS NULL OR json_extract(data, '$.isDeleted') != 1) AND data LIKE ? LIMIT 1"
              ).bind(id, keyPattern).first();
              if (otherOrder) {
                isUsedElsewhere = true;
                break;
              }
            }
          }

          if (isUsedElsewhere) {
            // SOFT-DELETE (HIDE): Keep in D1 so images and analytics data remain safe, but hide from dashboard orders
            orderData.isDeleted = true;
            await env.DB.prepare('UPDATE orders SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = ?')
              .bind(JSON.stringify(orderData), id, type)
              .run();
            softDeletedCount++;
          } else {
            // HARD-DELETE: Permanently delete from D1
            await env.DB.prepare('DELETE FROM orders WHERE id = ? AND type = ?').bind(id, type).run();
            hardDeletedCount++;

            // Collect orphaned keys for R2 deletion
            for (const key of orderKeys) {
              const keyPattern = `%${key}%`;
              const anyProd = await env.DB.prepare('SELECT id FROM products WHERE data LIKE ? LIMIT 1').bind(keyPattern).first();
              const anyOrder = await env.DB.prepare('SELECT id FROM orders WHERE id != ? AND data LIKE ? LIMIT 1').bind(id, keyPattern).first();
              const anySetting = await env.DB.prepare('SELECT key FROM settings WHERE value LIKE ? LIMIT 1').bind(keyPattern).first();

              if (!anyProd && !anyOrder && !anySetting) {
                r2KeysToDelete.push(key);
              }
            }
          }
        }

        // Option 1 Async Execution: clean up orphaned R2 keys via context.waitUntil
        if (context.waitUntil && r2KeysToDelete.length > 0 && env.BUCKET) {
          const uniqueKeys = Array.from(new Set(r2KeysToDelete));
          context.waitUntil(
            Promise.all(uniqueKeys.map((k: string) => env.BUCKET.delete(k).catch(() => {})))
          );
        }

        return Response.json({ success: true, deleted: ids.length, softDeleted: softDeletedCount, hardDeleted: hardDeletedCount });
      }
      return Response.json({ success: true, deleted: 0 });
    }

    if (action === 'sync_all') {
      await env.DB.prepare('DELETE FROM orders WHERE type = ?').bind(type).run();
      const stmts = items.map((o: any) => 
        env.DB.prepare('INSERT INTO orders (id, type, data) VALUES (?, ?, ?)').bind(o.id, type, JSON.stringify(o))
      );
      if (stmts.length > 0) {
        for (let i = 0; i < stmts.length; i += 50) {
          await env.DB.batch(stmts.slice(i, i + 50));
        }
      }
      return Response.json({ success: true, synced: items.length });
    }

    // Default: 'upsert'
    const stmts = items.map((o: any) => 
      env.DB.prepare('INSERT INTO orders (id, type, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, type = excluded.type, updated_at = CURRENT_TIMESTAMP').bind(o.id, type, JSON.stringify(o))
    );
    if (stmts.length > 0) {
        for (let i = 0; i < stmts.length; i += 50) {
          await env.DB.batch(stmts.slice(i, i + 50));
        }
    }
    
    return Response.json({ success: true, modified: items.length });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

import { deductOrderStock, getAvailableStock } from '../../src/lib/stockUtils';
import { broadcastStockToRetails, notifyMasterOfStockDeduction } from './_sync_broadcast';

function sanitizeOrderItem(item: any) {
  if (!item) return item;
  const p = item.product || {};
  return {
    id: item.id || p.id || '',
    product: {
      id: p.id || item.id || '',
      title: p.title || '',
      price: Number(p.price) || 0,
      buyPrice: p.buyPrice !== undefined ? Number(p.buyPrice) : undefined,
      image: p.thumbnail || p.image || '',
      thumbnail: p.thumbnail || p.image || '',
      category: p.category || '',
      supplier: p.supplier || '',
      material: p.material || '',
      variants: p.variants && item.variantId ? p.variants.filter((v: any) => v.id === item.variantId) : undefined
    },
    quantity: Number(item.quantity) || 1,
    color: item.color,
    variantId: item.variantId,
    variantName: item.variantName,
    variantPrice: item.variantPrice !== undefined ? Number(item.variantPrice) : undefined,
    variantBuyPrice: item.variantBuyPrice !== undefined ? Number(item.variantBuyPrice) : undefined,
    selectedOption: item.selectedOption
  };
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { order, customer, incompletePhone, incompleteOrderIdsToDelete, discountId } = data;

    if (!order || !order.items || !Array.isArray(order.items)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // 1. Generate secure sequential Order ID
    const maxRes = await env.DB.prepare("SELECT MAX(cast(id as integer)) as maxId FROM orders WHERE type = 'standard'").first();
    let nextId = Math.floor(100 + Math.random() * 900).toString();
    if (maxRes && maxRes.maxId) {
      nextId = (maxRes.maxId + 1).toString();
    }
    
    order.id = nextId;

    // Sanitize order items to prevent payload bloat while keeping all receipt details
    order.items = order.items.map(sanitizeOrderItem);

    const stmts: any[] = [];
    
    // 2. Insert Order
    stmts.push(
      env.DB.prepare('INSERT INTO orders (id, type, data) VALUES (?, ?, ?)')
      .bind(order.id, 'standard', JSON.stringify(order))
    );

    // 3. Upsert Customer
    if (customer && customer.id) {
      stmts.push(
        env.DB.prepare('INSERT INTO customers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP')
        .bind(customer.id, JSON.stringify(customer))
      );
    }

    // 4. Deduct Stock securely from DB products in safe batches
    const productIds = Array.from(new Set(order.items.map((i: any) => String(i.product?.id || i.id || '')).filter(Boolean)));
    let changedProducts: any[] = [];
    if (productIds.length > 0) {
      const CHUNK_SIZE = 30;
      const currentProducts: any[] = [];
      for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
        const chunk = productIds.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const productsRes = await env.DB.prepare(`SELECT id, data FROM products WHERE id IN (${placeholders})`).bind(...chunk).all();
        if (productsRes && productsRes.results) {
          currentProducts.push(...productsRes.results.map((r: any) => JSON.parse(r.data)));
        }
      }
      
      // Strict server-side stock validation: Ensure no item exceeds available inventory
      for (const item of order.items) {
        const pId = String(item.product?.id || item.id || '');
        const currentProd = currentProducts.find((p: any) => String(p.id) === pId);
        if (currentProd) {
          const availableStock = getAvailableStock(currentProd, item.variantId);
          if (availableStock <= 0) {
            return new Response(JSON.stringify({
              error: `"${currentProd.title || 'Product'}" is out of stock.`
            }), { status: 400 });
          }
          if (item.quantity > availableStock) {
            return new Response(JSON.stringify({
              error: `Only ${availableStock} items available for "${currentProd.title || 'Product'}". You ordered ${item.quantity}.`
            }), { status: 400 });
          }
        }
      }
      
      const newProducts = deductOrderStock(currentProducts, order);
      changedProducts = newProducts.filter((p: any) => order.items.some((item: any) => String(item.product?.id || item.id) === String(p.id)));

      if (changedProducts.length > 0) {
        for (const p of changedProducts) {
          stmts.push(
            env.DB.prepare('UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(JSON.stringify(p), String(p.id))
          );
        }
      }
    }

    // 5. Delete Incomplete Orders atomically
    const rawPhones: string[] = [];
    if (incompletePhone) rawPhones.push(String(incompletePhone).trim());
    if (order.userInfo?.phone) rawPhones.push(String(order.userInfo.phone).trim());

    const normalizedPhones: string[] = [];
    for (const p of rawPhones) {
      let cleaned = p.replace(/\D/g, '');
      if (cleaned.startsWith('880') && cleaned.length >= 13) cleaned = cleaned.substring(2);
      else if (cleaned.length === 10 && cleaned.startsWith('1')) cleaned = '0' + cleaned;
      if (cleaned) normalizedPhones.push(cleaned);
    }

    const allPhones = Array.from(new Set([
      ...rawPhones, 
      ...normalizedPhones, 
      ...normalizedPhones.map(p => '+88' + p),
      ...normalizedPhones.map(p => '88' + p)
    ]));
    const targetIds = Array.from(new Set([
      ...normalizedPhones.map(p => `inc_${p}`),
      ...(Array.isArray(incompleteOrderIdsToDelete) ? incompleteOrderIdsToDelete : [])
    ]));

    if (allPhones.length > 0 || targetIds.length > 0) {
      const conditions: string[] = [];
      const bindParams: any[] = [];

      if (targetIds.length > 0) {
        const idPlaceholders = targetIds.map(() => '?').join(',');
        conditions.push(`id IN (${idPlaceholders})`);
        bindParams.push(...targetIds);
      }

      if (allPhones.length > 0) {
        const phonePlaceholders = allPhones.map(() => '?').join(',');
        conditions.push(`json_extract(data, '$.phone') IN (${phonePlaceholders})`);
        bindParams.push(...allPhones);
        conditions.push(`json_extract(data, '$.normPhone') IN (${phonePlaceholders})`);
        bindParams.push(...allPhones);
      }

      if (conditions.length > 0) {
        stmts.push(
          env.DB.prepare(`DELETE FROM orders WHERE type = 'incomplete' AND (${conditions.join(' OR ')})`)
            .bind(...bindParams)
        );
      }
    }

    // 6. Update Discount usage
    if (discountId) {
       const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
       if (settingsRes && settingsRes.value) {
           let websiteSettings = JSON.parse(settingsRes.value as string);
           if (websiteSettings.discounts) {
               websiteSettings.discounts = websiteSettings.discounts.map((d: any) => {
                   if (d.id === discountId) {
                       return {
                           ...d,
                           limits: {
                               ...d.limits,
                               currentUsageGlobal: (d.limits.currentUsageGlobal || 0) + 1
                           }
                       };
                   }
                   return d;
               });
               stmts.push(
                   env.DB.prepare("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'websiteSettings'")
                   .bind(JSON.stringify(websiteSettings))
               );
           }
       }
    }

    // Execute transaction in safe chunks (max 40 stmts per batch to stay well below D1 limits)
    if (stmts.length > 0) {
      const BATCH_SIZE = 40;
      for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
        const batchChunk = stmts.slice(i, i + BATCH_SIZE);
        await env.DB.batch(batchChunk);
      }
    }

    // 7. If this is a connected Retail site, notify Master store to deduct stock
    const itemsToDeduct = (order.items || []).map((item: any) => {
      let variantIndex;
      if (item.variantId && item.product?.variants) {
        variantIndex = item.product.variants.findIndex((v: any) => v.id === item.variantId || v.name === item.variantName);
      }
      return {
        id: item.product?.id || item.id,
        variantId: item.variantId,
        variantName: item.variantName,
        variantIndex,
        qty: Number(item.quantity || 0)
      };
    });

    if (itemsToDeduct.length > 0) {
      if (context && typeof context.waitUntil === 'function') {
        context.waitUntil(notifyMasterOfStockDeduction(env, request, itemsToDeduct, context));
      } else {
        await notifyMasterOfStockDeduction(env, request, itemsToDeduct, context);
      }
    }

    // 8. Broadcast stock updates to registered retail stores if acting as Master
    if (changedProducts && changedProducts.length > 0) {
      if (context && typeof context.waitUntil === 'function') {
        context.waitUntil(broadcastStockToRetails(env, request, changedProducts, context));
      } else {
        await broadcastStockToRetails(env, request, changedProducts, context);
      }

      // Invalidate public_state cache
      try {
        const cache = (caches as any).default;
        const pubUrl = new URL('/api/public_state', request.url);
        if (context && typeof context.waitUntil === 'function') {
          context.waitUntil(cache.delete(new Request(pubUrl.toString())));
        } else {
          await cache.delete(new Request(pubUrl.toString()));
        }
      } catch (e) {}
    }

    return Response.json({ success: true, order });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), { status: 500 });
  }
}

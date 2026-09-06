export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const { action, itemIds } = await request.json();
    if (action !== 'delete' || !Array.isArray(itemIds) || itemIds.length === 0) {
      return Response.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // 1. Load websiteSettings to update hiddenAnalyticsItemIds
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
    const settings = settingsRes && settingsRes.value ? JSON.parse(settingsRes.value as string) : {};
    if (!settings.hiddenAnalyticsItemIds) {
      settings.hiddenAnalyticsItemIds = [];
    }

    const r2KeysToDelete: string[] = [];

    for (const id of itemIds) {
      const strId = String(id);
      // Hide from analytics items grid
      if (!settings.hiddenAnalyticsItemIds.includes(strId)) {
        settings.hiddenAnalyticsItemIds.push(strId);
      }

      // Check if this item is in active products or active orders
      const activeProd = await env.DB.prepare(
        "SELECT id, data FROM products WHERE id = ? AND (json_extract(data, '$.isDeleted') IS NULL OR json_extract(data, '$.isDeleted') != 1) LIMIT 1"
      ).bind(strId).first();

      const searchPatternId = `%"id":"${strId}"%`;
      const activeOrder = await env.DB.prepare(
        "SELECT id FROM orders WHERE (json_extract(data, '$.isDeleted') IS NULL OR json_extract(data, '$.isDeleted') != 1) AND data LIKE ? LIMIT 1"
      ).bind(searchPatternId).first();

      // If NOT used anywhere in active products or active orders, permanently clean it from D1/R2
      if (!activeProd && !activeOrder) {
        const prodRow = await env.DB.prepare("SELECT data FROM products WHERE id = ?").bind(strId).first();
        if (prodRow) {
          try {
            const pData = JSON.parse(prodRow.data);
            const urls = [
              pData.image,
              ...(Array.isArray(pData.images) ? pData.images : []),
              pData.thumbnail
            ];
            urls.forEach((u: string) => {
              const m = String(u || '').match(/(uploads\/.*)$/);
              if (m) r2KeysToDelete.push(m[1]);
            });
          } catch (e) {}
          await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(strId).run();
        }
      }
    }

    // Save updated websiteSettings in D1
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('websiteSettings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(JSON.stringify(settings))
      .run();

    // Option 1 Async Execution: clean up orphaned R2 keys without blocking
    if (context.waitUntil && r2KeysToDelete.length > 0 && env.BUCKET) {
      const uniqueKeys = Array.from(new Set(r2KeysToDelete));
      context.waitUntil(
        Promise.all(uniqueKeys.map((k: string) => env.BUCKET.delete(k).catch(() => {})))
      );
    }

    return Response.json({ success: true, hiddenAnalyticsItemIds: settings.hiddenAnalyticsItemIds });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

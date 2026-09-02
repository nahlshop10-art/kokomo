import { replaceUploadUrls } from './_domain';
export async function onRequestGet(context: any) {
  const { request, env, waitUntil } = context;
  const cache = (caches as any).default;
  const cacheKey = new Request(new URL('/api/public_state', request.url).toString());

  try {
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    const productsRes = await env.DB.prepare('SELECT id, data FROM products LIMIT 5000').all();
    const settingsRes = await env.DB.prepare('SELECT key, value FROM settings').all();

    const products = productsRes.results.map((r: any) => {
        const p = JSON.parse(r.data);
        delete p.buyPrice;
        delete p.autoPrice;
        delete p.supplier;
        delete p.stockOutDate;
        if (p.variants) {
            p.variants.forEach((v: any) => delete v.buyPrice);
        }
        return p;
    });

    const settings: Record<string, any> = {};
    for (const r of settingsRes.results) {
      if (r.key === 'adminUsers' || r.key === 'courierSettings' || r.key === 'priceCalculatorSettings' || r.key === 'registered_retails' || r.key === 'telegramNotification') {
        continue;
      }

      let value = JSON.parse(r.value);

      if (r.key === 'marketingSettings') {
        if (value?.tiktokPixel?.accessToken) delete value.tiktokPixel.accessToken;
        if (value?.metaPixel?.accessToken) delete value.metaPixel.accessToken;
        if (value?.ga4?.apiSecret) delete value.ga4.apiSecret;
      }

      if (r.key === 'websiteSettings' || r.key === 'website') {
         if (value?.telegramNotification) {
            delete value.telegramNotification.botToken;
            delete value.telegramNotification.chatId;
         }
         if (value?.suppliers) {
            delete value.suppliers;
         }
         if (value?.apiSync) {
            delete value.apiSync.masterApiKey;
            delete value.apiSync.connectedWebsites;
            delete value.apiSync.apiActivityLogs;
         }
         if (value?.apiSettings) {
            delete value.apiSettings.masterApiKey;
            delete value.apiSettings.connectedWebsites;
            delete value.apiSettings.apiActivityLogs;
            delete value.apiSettings.retailApiKey;
         }
      }

      settings[r.key] = value;
    }

    let responseBody = JSON.stringify({ products, settings });
    responseBody = replaceUploadUrls(responseBody, env);

    response = new Response(responseBody, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=120'
      }
    });

    if (waitUntil && typeof waitUntil === 'function') {
      waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

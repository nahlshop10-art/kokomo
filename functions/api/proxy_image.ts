export async function onRequestGet({ request, env, waitUntil }: any) {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 1. Check Cloudflare Edge Cache first to eliminate unnecessary requests
  const cache = (typeof caches !== 'undefined' && (caches as any).default) ? (caches as any).default : null;
  const cacheKey = new Request(request.url, request);
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch (cacheErr) {}
  }

  // 2. Try to read directly from R2 BUCKET binding if it's an uploaded asset
  if (targetUrl.includes('/uploads/')) {
    const key = 'uploads/' + targetUrl.split('/uploads/')[1].split('?')[0];
    if (env.BUCKET) {
      try {
        const object = await env.BUCKET.get(key);
        if (object) {
          const headers = new Headers();
          if (object.httpMetadata?.contentType) {
            headers.set('Content-Type', object.httpMetadata.contentType);
          } else {
            headers.set('Content-Type', key.endsWith('.png') ? 'image/png' : 'image/webp');
          }
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          if (object.httpEtag) {
            headers.set('ETag', object.httpEtag);
          }
          const resp = new Response(object.body, { headers });
          if (cache && waitUntil) {
            try { waitUntil(cache.put(cacheKey, resp.clone())); } catch (e) {}
          }
          return resp;
        }
      } catch (e) {
        console.error('R2 read error in proxy_image:', e);
      }
    }
  }

  // 3. Fallback: fetch remote URL and attach CORS headers
  try {
    let fetchUrl = targetUrl.trim();
    if (fetchUrl.startsWith('//')) {
      fetchUrl = 'https:' + fetchUrl;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fetchUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Enforce HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only HTTPS URLs are allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Prevent access to internal / private networks and metadata endpoints
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname === '169.254.169.254' ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return new Response(JSON.stringify({ error: 'Access to private addresses is prohibited' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Strict domain allowlist for 1688, Taobao, Alibaba CDNs, R2, and current site
    const allowedSuffixes = [
      'alicdn.com',
      '1688.com',
      'taobao.com',
      'taobaocdn.com',
      'tmall.com',
      'r2.dev',
      'pages.dev',
      'workers.dev'
    ];

    const isAllowedHost = allowedSuffixes.some(s => hostname === s || hostname.endsWith('.' + s)) ||
      (env.R2_PUBLIC_DOMAIN && hostname.includes(env.R2_PUBLIC_DOMAIN.toLowerCase())) ||
      hostname === urlObj.hostname.toLowerCase();

    if (!isAllowedHost) {
      return new Response(JSON.stringify({ error: 'Destination host not permitted for image proxying' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://detail.1688.com/'
      }
    });
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      
      const cType = headers.get('Content-Type');
      if (!cType || cType.includes('text/html')) {
        const ext = fetchUrl.split('?')[0].split('.').pop()?.toLowerCase();
        if (ext === 'webp') headers.set('Content-Type', 'image/webp');
        else if (ext === 'png') headers.set('Content-Type', 'image/png');
        else if (ext === 'jpg' || ext === 'jpeg') headers.set('Content-Type', 'image/jpeg');
      }
      const response = new Response(res.body, { status: res.status, headers });
      if (cache && waitUntil) {
        try { waitUntil(cache.put(cacheKey, response.clone())); } catch (e) {}
      }
      return response;
    }
    return new Response('Remote image not found', { 
      status: res.status,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Proxy fetch failed' }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
}

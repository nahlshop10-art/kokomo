import { hashPassword, isLegacyPlaintext } from './_crypto';

export async function onRequestPost(context: any) {
  const { request, env, waitUntil, data: ctxData } = context;
  try {
    const data = await request.json();
    const { key, value } = data; 
    
    if (!key || value === undefined) {
      return new Response('Invalid payload', { status: 400 });
    }

    const isOwner = Boolean(ctxData?.isOwner);

    // High security: Only Owner can modify admin users, marketing credentials, or sync settings
    const ownerOnlyKeys = ['adminUsers', 'marketingSettings', 'registered_retails', 'courierSettings'];
    if (ownerOnlyKeys.includes(key) && !isOwner) {
      return new Response(JSON.stringify({ error: `Forbidden: Only the Owner account can modify ${key}.` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let finalValue = value;
    if (key === 'adminUsers') {
      const currentRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
      const currentUsers = currentRes.results.length > 0 ? JSON.parse(currentRes.results[0].value) : [];
      if (Array.isArray(value)) {
        finalValue = await Promise.all(value.map(async (u: any) => {
          const existing = currentUsers.find((cu: any) => cu.email === u.email);
          let hashToUse = u.passwordHash;
          if (!hashToUse && existing && existing.passwordHash) {
            hashToUse = existing.passwordHash;
          }
          // Hash with PBKDF2 if new plaintext password was submitted
          if (hashToUse && isLegacyPlaintext(hashToUse)) {
            hashToUse = await hashPassword(hashToUse);
          }
          return { ...u, passwordHash: hashToUse };
        }));
      }
    }

    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
      .bind(key, JSON.stringify(finalValue))
      .run();
    
    // Invalidate public_state cache
    const cache = (caches as any).default;
    const url = new URL('/api/public_state', request.url);
    if (waitUntil) {
      waitUntil(cache.delete(new Request(url.toString())));
    } else {
      await cache.delete(new Request(url.toString()));
    }

    return Response.json({ success: true, key });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

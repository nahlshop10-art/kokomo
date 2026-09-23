import { jwtVerify } from 'jose';

export async function onRequest(context: any) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return next();
  }

  const publicPaths = [
    '/api/public_state',
    '/api/login',
    '/api/register',
    '/api/logout',
    '/api/sync_check',
    '/api/sync_data',
    '/api/public_checkout',
    '/api/public_incomplete_order',
    '/api/public_add_to_order',
    '/api/public_cancel_order',
    '/api/sync_deduct_stock',
    '/api/get_my_orders',
    '/api/facebook',
    '/api/tiktok',
    '/api/ga4',
    '/api/send_telegram',
    '/api/proxy_image'
  ];

  if (publicPaths.includes(path)) {
    return next();
  }

  const authHeader = request.headers.get('Authorization');
  const tokenFromHeader = authHeader ? authHeader.replace('Bearer ', '').replace('Admin ', '') : null;

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
  const adminToken = cookies['admin_token'];

  if (path === '/api/sync_apply') {
    const storeSettingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('websiteSettings').all();
    const storeSettings = storeSettingsRes.results.length > 0 ? JSON.parse(storeSettingsRes.results[0].value) : {};

    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('CRITICAL: JWT_SECRET environment variable is missing.');
      return new Response(JSON.stringify({ error: 'Server authentication configuration error.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Check if called by logged-in admin
    let isAdminAuth = false;
    if (adminToken) {
      try {
        const secret = new TextEncoder().encode(jwtSecret);
        await jwtVerify(adminToken, secret);
        isAdminAuth = true;
      } catch (e) {}
    }

    // 2. Check if called by Master using Master API Key
    const isMasterKeyAuth = Boolean(
      tokenFromHeader && 
      storeSettings?.apiSync?.connectedMasterApiKey && 
      tokenFromHeader.trim() === storeSettings.apiSync.connectedMasterApiKey.trim()
    );

    if (!isAdminAuth && !isMasterKeyAuth) {
      return new Response(JSON.stringify({ error: 'Unauthorized retail sync' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    return next();
  }

  if (!adminToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Missing Token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('CRITICAL: JWT_SECRET environment variable is missing.');
    return new Response(JSON.stringify({ error: 'Server authentication configuration error.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(adminToken, secret);
    
    // Check if the user is blocked or deleted in DB
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    const user = adminUsers.find((u: any) => u.email && u.email.trim().toLowerCase() === String(payload.email || '').trim().toLowerCase());
    
    if (!user || user.isBlocked || !user.isApproved) {
        return new Response(JSON.stringify({ error: 'Unauthorized or blocked admin' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const isOwner = Boolean(
      (user.role === 'Owner' || user.email?.toLowerCase() === 'max@gmail.com') &&
      !user.isBlocked &&
      user.isApproved
    );

    context.data = context.data || {};
    context.data.user = user;
    context.data.isOwner = isOwner;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Invalid Token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }


  const response = await next();
  
  // Attach edge security headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce OWASP security: never store authenticated admin or customer data in cache
  if (!publicPaths.includes(path) && !newHeaders.has('Cache-Control')) {
    newHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    newHeaders.set('Pragma', 'no-cache');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

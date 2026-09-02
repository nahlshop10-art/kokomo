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

    // 1. Check if called by logged-in admin
    let isAdminAuth = false;
    if (adminToken) {
      try {
        const secret = new TextEncoder().encode(env.JWT_SECRET || 'default_secret_change_in_production');
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

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'default_secret_change_in_production');
    const { payload } = await jwtVerify(adminToken, secret);
    
    // Check if the user is blocked or deleted in DB
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    const user = adminUsers.find((u: any) => u.email === payload.email);
    
    if (!user || user.isBlocked || !user.isApproved) {
        return new Response(JSON.stringify({ error: 'Unauthorized or blocked admin' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Invalid Token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const response = await next();
  
  // Attach edge security headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

import { SignJWT } from 'jose';
import { verifyPassword, hashPassword, isLegacyPlaintext, sanitizeUser } from './_crypto';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: 'Email and password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    let adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];

    // Find user by normalized email
    const userIndex = adminUsers.findIndex((u: any) => u.email && u.email.trim().toLowerCase() === trimmedEmail);
    if (userIndex === -1) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = adminUsers[userIndex];

    const isPasswordValid = await verifyPassword(String(password), user.passwordHash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check account status
    if (user.isBlocked) {
      return new Response(JSON.stringify({ success: false, error: 'This account has been suspended.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!user.isApproved) {
      return new Response(JSON.stringify({ success: false, error: 'Account not approved yet.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Seamless migration: If stored password was legacy plaintext, upgrade to PBKDF2 hash automatically
    if (isLegacyPlaintext(user.passwordHash)) {
      user.passwordHash = await hashPassword(String(password));
      adminUsers[userIndex] = user;
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('adminUsers', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
        .bind(JSON.stringify(adminUsers))
        .run();
    }

    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('CRITICAL: JWT_SECRET environment variable is missing.');
      return new Response(JSON.stringify({ success: false, error: 'Server authentication configuration error.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ email: user.email, role: user.role || 'Admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const safeUser = sanitizeUser(user);
    const headers = new Headers();
    headers.set('Set-Cookie', `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
    headers.set('Content-Type', 'application/json');

    return new Response(JSON.stringify({ success: true, user: safeUser }), { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal login error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

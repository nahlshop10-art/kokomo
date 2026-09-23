import { hashPassword, sanitizeUser } from './_crypto';

export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Email and password are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (password.length < 4) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 4 characters.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    
    if (adminUsers.some((u: any) => u.email && u.email.trim().toLowerCase() === trimmedEmail)) {
        return new Response(JSON.stringify({ success: false, error: 'Email already exists.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const secureHash = await hashPassword(password);
    
    const newUser = {
        id: Date.now().toString(),
        email: trimmedEmail,
        passwordHash: secureHash,
        isApproved: false,
        createdAt: new Date().toISOString()
    };
    
    adminUsers.push(newUser);
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('adminUsers', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
        .bind(JSON.stringify(adminUsers)).run();
        
    const safeUser = sanitizeUser(newUser);
        
    return new Response(JSON.stringify({ success: true, user: safeUser }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


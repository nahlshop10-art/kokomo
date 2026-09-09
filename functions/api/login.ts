import { SignJWT } from 'jose';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();

    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    let adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    
    let user = adminUsers.find((u: any) => u.email.trim() === email.trim() && u.passwordHash === password);

    // Fallback/Seed: allow max@gmail.com / 1234 to login always and seed/fix the DB if needed
    if (!user && email.trim() === 'max@gmail.com' && password === '1234') {
        const existingUser = adminUsers.find((u: any) => u.email.trim() === 'max@gmail.com');
        
        if (!existingUser) {
            user = {
                id: Date.now().toString(),
                email: 'max@gmail.com',
                passwordHash: '1234',
                isApproved: true,
                createdAt: new Date().toISOString()
            };
            adminUsers.push(user);
            await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                .bind('adminUsers', JSON.stringify(adminUsers)).run();
        } else {
            // Reset password if it's incorrect (user wants this as default)
            existingUser.passwordHash = '1234';
            existingUser.isApproved = true;
            user = existingUser;
            await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                .bind('adminUsers', JSON.stringify(adminUsers)).run();
        }
    }

    // Ensure max@gmail.com always has Role: Owner
    if (user && user.email.trim().toLowerCase() === 'max@gmail.com' && user.role !== 'Owner') {
        user.role = 'Owner';
        await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .bind('adminUsers', JSON.stringify(adminUsers)).run();
    }

    // Additional check: if they register max@gmail.com but it's not approved, approve it
    if (user && !user.isApproved && user.email.trim().toLowerCase() === 'max@gmail.com') {
        user.isApproved = true;
        user.role = 'Owner';
        await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .bind('adminUsers', JSON.stringify(adminUsers)).run();
    }

    if (user && user.isApproved) {
       const secret = new TextEncoder().encode(env.JWT_SECRET || 'default_secret_change_in_production');
       const token = await new SignJWT({ email: user.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(secret);
          
       const headers = new Headers();
       headers.set('Set-Cookie', `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7*24*60*60}`);
       headers.set('Content-Type', 'application/json');
       return new Response(JSON.stringify({ success: true, user }), { headers });
    } else if (user && !user.isApproved) {
       return new Response(JSON.stringify({ success: false, error: 'Account not approved yet.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid email or password.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

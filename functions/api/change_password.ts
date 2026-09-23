import { verifyPassword, hashPassword } from './_crypto';

export async function onRequestPost(context: any) {
  const { request, env, data } = context;
  try {
    const { currentPassword, newPassword } = await request.json();

    const currentUser = data?.user;
    if (!currentUser) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ success: false, error: 'All fields are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (newPassword.length < 4) {
      return new Response(JSON.stringify({ success: false, error: 'New password must be at least 4 characters.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Load user from DB to verify current password
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];

    const userIndex = adminUsers.findIndex((u: any) => u.id === currentUser.id || u.email === currentUser.email);
    if (userIndex === -1) {
      return new Response(JSON.stringify({ success: false, error: 'User not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const userInDb = adminUsers[userIndex];
    const isCurrentValid = await verifyPassword(currentPassword, userInDb.passwordHash);
    if (!isCurrentValid) {
      return new Response(JSON.stringify({ success: false, error: 'Incorrect current password.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Hash new password using PBKDF2
    const newHash = await hashPassword(newPassword);
    adminUsers[userIndex].passwordHash = newHash;

    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('adminUsers', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
      .bind(JSON.stringify(adminUsers)).run();

    return new Response(JSON.stringify({ success: true, message: 'Password updated successfully!' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

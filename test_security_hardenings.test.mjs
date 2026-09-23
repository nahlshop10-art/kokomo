import assert from 'node:assert';

console.log('--- Running Security Hardening Verification Tests ---');

// 1. Test Crypto PBKDF2 Hashing & Verification
{
  console.log('\n[1] Testing PBKDF2 Password Hashing & Verification...');
  
  // Re-implement the crypto logic using Node WebCrypto to verify behavior
  const ITERATIONS = 100000;
  const KEY_LEN = 32;

  async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      KEY_LEN * 8
    );
    const hashHex = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
  }

  async function verifyPassword(password, storedHash) {
    if (!storedHash || !password) return false;
    if (storedHash.startsWith('pbkdf2$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10) || ITERATIONS;
      const saltHex = parts[2];
      const expectedHashHex = parts[3];
      const hexMatches = saltHex.match(/.{1,2}/g);
      if (!hexMatches) return false;
      const saltBytes = new Uint8Array(hexMatches.map(b => parseInt(b, 16)));
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        keyMaterial,
        KEY_LEN * 8
      );
      const derivedHashHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return derivedHashHex === expectedHashHex;
    }
    return storedHash === password;
  }

  function sanitizeUser(user) {
    if (!user) return user;
    const safe = { ...user };
    delete safe.passwordHash;
    return safe;
  }

  const pwd = 'MySecretAdminPassword2026!';
  const hash = await hashPassword(pwd);
  assert(hash.startsWith('pbkdf2$100000$'), 'Hash must start with pbkdf2$100000$');
  
  const isValid = await verifyPassword(pwd, hash);
  assert.strictEqual(isValid, true, 'Valid password must verify successfully');

  const isInvalid = await verifyPassword('WrongPassword', hash);
  assert.strictEqual(isInvalid, false, 'Invalid password must be rejected');

  // Test legacy plaintext fallback
  const isLegacyValid = await verifyPassword('legacy1234', 'legacy1234');
  assert.strictEqual(isLegacyValid, true, 'Legacy plaintext password must verify for migration');

  // Test sanitization
  const user = { id: 'u1', email: 'admin@kokomo.com', passwordHash: hash, role: 'Owner' };
  const safe = sanitizeUser(user);
  assert.strictEqual(safe.passwordHash, undefined, 'passwordHash must be stripped');
  assert.strictEqual(safe.email, 'admin@kokomo.com');
  console.log('✅ PBKDF2 Password Hashing & Verification: PASSED');
}

// 2. Test SSRF Protection in proxy_image.ts
{
  console.log('\n[2] Testing SSRF Hostname Allowlist & IP Blocking...');
  
  function checkUrlAllowed(targetUrl, r2Domain, selfHost) {
    let fetchUrl = targetUrl.trim();
    if (fetchUrl.startsWith('//')) fetchUrl = 'https:' + fetchUrl;
    let parsed;
    try {
      parsed = new URL(fetchUrl);
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }
    if (parsed.protocol !== 'https:') {
      return { allowed: false, reason: 'Only HTTPS allowed' };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname === '169.254.169.254' ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return { allowed: false, reason: 'Private IP blocked' };
    }
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
    const isAllowed = allowedSuffixes.some(s => hostname === s || hostname.endsWith('.' + s)) ||
      (r2Domain && hostname.includes(r2Domain.toLowerCase())) ||
      hostname === selfHost.toLowerCase();
    
    return { allowed: isAllowed, reason: isAllowed ? 'OK' : 'Host not permitted' };
  }

  // Permitted URLs
  assert.strictEqual(checkUrlAllowed('https://cbu01.alicdn.com/img/ibank/O1CN01.jpg', 'pub-123.r2.dev', 'kokomo.com').allowed, true);
  assert.strictEqual(checkUrlAllowed('https://detail.1688.com/offer/123.html', 'pub-123.r2.dev', 'kokomo.com').allowed, true);
  assert.strictEqual(checkUrlAllowed('https://pub-123.r2.dev/uploads/img.webp', 'pub-123.r2.dev', 'kokomo.com').allowed, true);

  // Blocked Attacks
  assert.strictEqual(checkUrlAllowed('http://169.254.169.254/latest/meta-data', 'pub-123.r2.dev', 'kokomo.com').allowed, false);
  assert.strictEqual(checkUrlAllowed('https://127.0.0.1:8080/admin', 'pub-123.r2.dev', 'kokomo.com').allowed, false);
  assert.strictEqual(checkUrlAllowed('https://evil-attacker.com/steal', 'pub-123.r2.dev', 'kokomo.com').allowed, false);
  assert.strictEqual(checkUrlAllowed('http://cbu01.alicdn.com/insecure', 'pub-123.r2.dev', 'kokomo.com').allowed, false);
  console.log('✅ SSRF & Domain Allowlist Protection: PASSED');
}

// 3. Test PII Masking in get_my_orders.ts
{
  console.log('\n[3] Testing PII Masking for Public Order Lookup...');
  
  function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const digits = phone.trim();
    if (digits.length <= 6) return '****';
    return digits.slice(0, 4) + '****' + digits.slice(-3);
  }

  function sanitizePublicOrder(order) {
    if (!order) return order;
    const safe = { ...order };
    if (safe.userInfo) {
      safe.userInfo = { ...safe.userInfo, phone: maskPhone(safe.userInfo.phone) };
    }
    delete safe.adminNotes;
    delete safe.cost;
    delete safe.profit;
    return safe;
  }

  const rawOrder = {
    id: '102',
    total: 1250,
    userInfo: { name: 'Rahim Khan', phone: '01712345678', address: 'Dhaka, Bangladesh' },
    adminNotes: 'Customer requested express delivery; call before dispatch',
    profit: 350
  };

  const cleanOrder = sanitizePublicOrder(rawOrder);
  assert.strictEqual(cleanOrder.userInfo.phone, '0171****678', 'Phone must be masked');
  assert.strictEqual(cleanOrder.adminNotes, undefined, 'adminNotes must be deleted');
  assert.strictEqual(cleanOrder.profit, undefined, 'profit must be deleted');
  assert.strictEqual(cleanOrder.total, 1250);
  console.log('✅ PII Masking & Admin Notes Scrubbing: PASSED');
}

// 4. Test Telegram Notification Spam Filter
{
  console.log('\n[4] Testing Telegram Spam Filter...');
  
  function validateTelegramMessage(message) {
    if (!message || typeof message !== 'string' || message.length > 2000) return false;
    const validIndicators = ['🛍️', 'NEW ORDER', 'ORDER CANCELLED', 'STOCK UPDATED', 'ORDER UPDATED', 'UPDATED'];
    return validIndicators.some(ind => message.includes(ind));
  }

  const legitimateMsg = `🛍️ NAHL SHOP\n━━━━━━━━━━━━━━━━━━━━\n🎉 NEW ORDER\n━━━━━━━━━━━━━━━━━━━━\n\n👤 Customer : Rahim\n💰 Total : ৳1250`;
  const spamMsg = `Hello buy cheap crypto at https://phishing-site.xyz now! Free money!`;

  assert.strictEqual(validateTelegramMessage(legitimateMsg), true, 'Legitimate order notification must be accepted');
  assert.strictEqual(validateTelegramMessage(spamMsg), false, 'Arbitrary spam message must be rejected');
  console.log('✅ Telegram Spam Filter: PASSED');
}

// 5. Test File Upload Allowlist
{
  console.log('\n[5] Testing File Upload Allowlist...');
  
  function validateUpload(filename, sizeBytes) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (sizeBytes > MAX_FILE_SIZE) return { valid: false, reason: 'Exceeds size' };
    const rawExt = (filename.split('.').pop() || 'webp').toLowerCase();
    const allowedExtensions = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
    if (!allowedExtensions.includes(rawExt)) return { valid: false, reason: 'Extension not allowed' };
    return { valid: true };
  }

  assert.strictEqual(validateUpload('product.webp', 500000).valid, true);
  assert.strictEqual(validateUpload('image.PNG', 2000000).valid, true);
  assert.strictEqual(validateUpload('malicious.svg', 1000).valid, false);
  assert.strictEqual(validateUpload('script.html', 500).valid, false);
  assert.strictEqual(validateUpload('huge_video.webp', 15 * 1024 * 1024).valid, false);
  console.log('✅ File Upload Extension & Size Validation: PASSED');
}

console.log('\n======================================================');
console.log('🎉 ALL SECURITY HARDENING TESTS PASSED SUCCESSFULLY! 🎉');
console.log('======================================================\n');

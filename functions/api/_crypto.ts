const ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bits

/**
 * Hashes a plaintext password using PBKDF2-HMAC-SHA256 with 100,000 iterations
 * and a cryptographically secure random 16-byte salt.
 */
export async function hashPassword(password: string): Promise<string> {
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
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LEN * 8
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored hash string.
 * Supports PBKDF2 hashes as well as legacy plaintext records (for zero-downtime migration).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !password) return false;
  
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10) || ITERATIONS;
    const saltHex = parts[2];
    const expectedHashHex = parts[3];
    
    const hexMatches = saltHex.match(/.{1,2}/g);
    if (!hexMatches) return false;
    const saltBytes = new Uint8Array(hexMatches.map(byte => parseInt(byte, 16)));
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      KEY_LEN * 8
    );

    const derivedHashHex = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return derivedHashHex === expectedHashHex;
  }

  // Backwards compatibility check for legacy plaintext passwords
  return storedHash === password;
}

/**
 * Returns true if the stored hash is legacy plaintext and should be upgraded.
 */
export function isLegacyPlaintext(storedHash: string): boolean {
  return !storedHash || !storedHash.startsWith('pbkdf2$');
}

/**
 * Returns a sanitized clone of the user object without passwordHash or credentials.
 */
export function sanitizeUser(user: any): any {
  if (!user || typeof user !== 'object') return user;
  const safe = { ...user };
  delete safe.passwordHash;
  return safe;
}

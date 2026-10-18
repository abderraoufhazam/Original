// api/_crypto.js
// Helper de chiffrement AES-256-GCM + hash SHA-256

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// 🔐 7 caractères (32^7 = 34 milliards de combinaisons)
// Sécurisé avec rate limiting
const CODE_LENGTH = 7;

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not configured');
  return crypto.createHash('sha256').update(key).digest();
}

export function hashCode(code) {
  return crypto.createHash('sha256')
    .update(code.trim().toUpperCase())
    .digest('hex');
}

export function encryptCode(code) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(code, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptCode(encryptedBase64) {
  const key = getKey();
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.slice(0, IV_LENGTH);
  const authTag = data.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

// ✅ 7 caractères — sans 0/O, 1/I/L
export function generateSecretCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += chars[bytes[i] % chars.length];
  }
  return s;
}

// ✅ Formatage pour affichage
export function formatDisplayCode(code) {
  if (!code) return '';
  const s = String(code).trim().toUpperCase();
  // 7 → XXX-XXXX
  if (s.length === 7) return s.slice(0, 3) + '-' + s.slice(3);
  // 12 (ancien) → XXXX XXXX XXXX
  if (s.length === 12) return s.match(/.{1,4}/g).join(' ');
  // autres → tel quel
  return s;
}

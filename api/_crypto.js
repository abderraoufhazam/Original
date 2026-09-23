// api/_crypto.js
// Helper de chiffrement AES-256-GCM + hash SHA-256

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96 bits pour GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Dérive une clé 32-byte (256-bit) à partir de la variable ENCRYPTION_KEY
 */
function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not configured');
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Hash SHA-256 d'un code (pour la recherche rapide + vérification)
 */
export function hashCode(code) {
  return crypto.createHash('sha256')
    .update(code.trim().toUpperCase())
    .digest('hex');
}

/**
 * Chiffre un code avec AES-256-GCM.
 * Format de sortie : base64( IV (12) + AuthTag (16) + Ciphertext )
 */
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

/**
 * Déchiffre un code précédemment chiffré avec encryptCode()
 */
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

/**
 * Génère un code secret aléatoire de 12 caractères
 * (Sans caractères ambigus : 0/O, 1/I/L)
 */
export function generateSecretCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += chars[bytes[i] % chars.length];
  }
  return s;
}

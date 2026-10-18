// __tests__/crypto.test.js
import { describe, it, expect } from 'vitest';

process.env.ENCRYPTION_KEY = 'test-key-min-32-chars-long-for-testing';

const { 
  hashCode, 
  generateSecretCode, 
  encryptCode, 
  decryptCode,
  formatDisplayCode 
} = await import('../api/_crypto.js');

// ═══════════════════════════════════════════════════════════
// hashCode
// ═══════════════════════════════════════════════════════════
describe('hashCode', () => {
  it('returns 64-char hex string', () => {
    const hash = hashCode('ABC1234');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('gives same hash for same input', () => {
    expect(hashCode('ABC1234')).toBe(hashCode('ABC1234'));
  });

  it('gives different hash for different input', () => {
    expect(hashCode('ABC1234')).not.toBe(hashCode('XYZ9876'));
  });

  it('normalizes input (trim + uppercase)', () => {
    expect(hashCode(' abc1234 ')).toBe(hashCode('ABC1234'));
  });
});

// ═══════════════════════════════════════════════════════════
// generateSecretCode
// ═══════════════════════════════════════════════════════════
describe('generateSecretCode', () => {
  it('generates exactly 7 characters', () => {
    const code = generateSecretCode();
    expect(code.length).toBe(7);
  });

  it('only uses allowed characters (no I, O, L, 0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSecretCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
      expect(code).not.toContain('I');
      expect(code).not.toContain('O');
      expect(code).not.toContain('L');
      expect(code).not.toContain('0');
      expect(code).not.toContain('1');
    }
  });

  it('generates 100 unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateSecretCode());
    }
    expect(codes.size).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════
// encryptCode / decryptCode
// ═══════════════════════════════════════════════════════════
describe('encryptCode / decryptCode', () => {
  it('roundtrip: encrypt then decrypt = original', () => {
    const original = 'ABC1234';
    const encrypted = encryptCode(original);
    const decrypted = decryptCode(encrypted);
    expect(decrypted).toBe(original);
  });

  it('encrypting same code twice gives different outputs', () => {
    const code = 'ABC1234';
    const enc1 = encryptCode(code);
    const enc2 = encryptCode(code);
    expect(enc1).not.toBe(enc2);
    expect(decryptCode(enc1)).toBe(code);
    expect(decryptCode(enc2)).toBe(code);
  });

  it('throws on invalid encrypted data', () => {
    expect(() => decryptCode('invalid-base64')).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// formatDisplayCode
// ═══════════════════════════════════════════════════════════
describe('formatDisplayCode', () => {
  it('formats 7-char code as XXX-XXXX', () => {
    expect(formatDisplayCode('ABC1234')).toBe('ABC-1234');
  });

  it('formats 12-char code as groups of 4', () => {
    expect(formatDisplayCode('ABCD1234EFGH')).toBe('ABCD 1234 EFGH');
  });

  it('returns empty for empty input', () => {
    expect(formatDisplayCode('')).toBe('');
    expect(formatDisplayCode(null)).toBe('');
  });

  it('uppercases input', () => {
    expect(formatDisplayCode('abc1234')).toBe('ABC-1234');
  });
});

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/lib/crypto.js';

const KEY = 'test-aes-key-32bytes-padded-here';

describe('crypto', () => {
  it('encrypt produces iv:ciphertext format', () => {
    const blob = encrypt({ hello: 'world' }, KEY);
    expect(blob).toMatch(/^[0-9a-f]+:.+$/);
  });

  it('decrypt recovers original object', () => {
    const payload = { planCode: 'P001', price: 25.99 };
    const blob = encrypt(payload, KEY);
    const recovered = decrypt<typeof payload>(blob, KEY);
    expect(recovered).toEqual(payload);
  });

  it('each encrypt call produces different ciphertext (random IV)', () => {
    const blob1 = encrypt({ a: 1 }, KEY);
    const blob2 = encrypt({ a: 1 }, KEY);
    expect(blob1).not.toBe(blob2);
  });

  it('decrypt throws on malformed blob', () => {
    expect(() => decrypt('notvalidblob', KEY)).toThrow();
  });
});

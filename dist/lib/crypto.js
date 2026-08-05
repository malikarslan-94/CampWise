import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size
/**
 * Encrypts a plain object to a base64 string.
 * Format: <iv_hex>:<ciphertext_base64>
 * The IV is randomly generated per call and prepended so decrypt can recover it.
 * Key must be exactly 32 bytes (256 bits); pass as hex string or raw Buffer.
 */
export function encrypt(payload, keyHex) {
    const key = Buffer.from(keyHex, 'utf8').subarray(0, 32); // take first 32 bytes if longer
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const json = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('base64')}`;
}
/**
 * Decrypts a string produced by encrypt().
 * Returns the original object.
 */
export function decrypt(blob, keyHex) {
    const [ivHex, cipherBase64] = blob.split(':');
    if (!ivHex || !cipherBase64)
        throw new Error('Invalid encrypted blob format');
    const key = Buffer.from(keyHex, 'utf8').subarray(0, 32);
    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(cipherBase64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}
//# sourceMappingURL=crypto.js.map
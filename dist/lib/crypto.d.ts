/**
 * Encrypts a plain object to a base64 string.
 * Format: <iv_hex>:<ciphertext_base64>
 * The IV is randomly generated per call and prepended so decrypt can recover it.
 * Key must be exactly 32 bytes (256 bits); pass as hex string or raw Buffer.
 */
export declare function encrypt(payload: unknown, keyHex: string): string;
/**
 * Decrypts a string produced by encrypt().
 * Returns the original object.
 */
export declare function decrypt<T = unknown>(blob: string, keyHex: string): T;
//# sourceMappingURL=crypto.d.ts.map
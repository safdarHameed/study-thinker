import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for learners' provider API keys. Stored as
 * `v1.<iv>.<tag>.<ciphertext>` (base64url parts).
 */
export class KeyVault {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(`studythinker-ai-keys:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv, tag, data]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, data] = stored.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable key');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

/** "…a1b2" — enough to recognise a key without revealing it. */
export const keyHint = (key: string) => `…${key.trim().slice(-4)}`;

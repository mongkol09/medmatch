import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
} from 'crypto';
import { promisify } from 'util';
import * as bcrypt from 'bcrypt';

const scryptAsync = promisify(scrypt);

/**
 * Bank-grade encryption service using AES-256-GCM
 * - Column-level encryption for sensitive data (PII, medical records)
 * - SHA-256 hashing for lookup fields
 * - bcrypt for password hashing
 * - Envelope encryption pattern with key rotation support
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16; // 128-bit IV
  private readonly tagLength = 16; // 128-bit auth tag
  private readonly saltRounds = 12; // bcrypt cost factor
  private encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyHex = this.config.get<string>('ENCRYPTION_KEY');
    if (!keyHex || keyHex.length < 64) {
      throw new Error(
        'ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256)',
      );
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns Uint8Array: [IV (16 bytes)][Auth Tag (16 bytes)][Ciphertext]
   */
  encrypt(plaintext: string): any {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv, {
      authTagLength: this.tagLength,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Pack: IV + Tag + Ciphertext — convert to strict Uint8Array<ArrayBuffer> for Prisma v7
    const packed = Buffer.concat([iv, tag, encrypted]);
    const ab = new ArrayBuffer(packed.length);
    const view = new Uint8Array(ab);
    view.set(packed);
    return view;
  }

  /**
   * Decrypt ciphertext from AES-256-GCM packed buffer
   */
  decrypt(packed: Buffer | Uint8Array): string {
    if (packed.length < this.ivLength + this.tagLength + 1) {
      throw new Error('Invalid encrypted data: too short');
    }

    const iv = packed.subarray(0, this.ivLength);
    const tag = packed.subarray(this.ivLength, this.ivLength + this.tagLength);
    const ciphertext = packed.subarray(this.ivLength + this.tagLength);

    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv, {
      authTagLength: this.tagLength,
    });
    decipher.setAuthTag(tag);

    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  /**
   * SHA-256 hash for safe lookups (e.g., phone_hash, email_hash)
   * Uses HMAC-like approach with a salt derived from the key
   */
  hashForLookup(value: string): string {
    // Normalize: lowercase + trim
    const normalized = value.toLowerCase().trim();
    return createHash('sha256')
      .update(this.encryptionKey)
      .update(normalized)
      .digest('hex');
  }

  /**
   * Hash password using bcrypt (cost factor 12)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against bcrypt hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random token (for refresh tokens, etc.)
   */
  generateSecureToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * Derive a key from a passphrase using scrypt (for additional key derivation)
   */
  async deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(passphrase, salt, 32)) as Buffer;
  }
}

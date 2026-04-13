/**
 * StorageService — abstracted file upload
 * Supports: local (dev) | Oracle Object Storage (via PAR) | S3-compatible (Cloudflare R2 / MinIO)
 *
 * Env vars:
 *   STORAGE_PROVIDER          local | oracle | s3          (default: local)
 *   APP_BASE_URL              http://localhost:3000         (local dev)
 *   STORAGE_ORACLE_PAR_URL    https://objectstorage.../par  (oracle)
 *   STORAGE_PUBLIC_BASE_URL   https://cdn.example.com      (public read base)
 *   STORAGE_S3_ENDPOINT       https://...r2.cloudflarestorage.com
 *   STORAGE_S3_BUCKET         medmatch
 *   STORAGE_S3_ACCESS_KEY     ...
 *   STORAGE_S3_SECRET_KEY     ...
 *   STORAGE_S3_REGION         auto
 */
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export type StorageFolder = 'profiles' | 'licenses' | 'slips' | 'clinics';
type StorageProvider = 'local' | 'oracle' | 's3';

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly provider: StorageProvider;

    constructor(private readonly config: ConfigService) {
        this.provider = config.get<StorageProvider>('STORAGE_PROVIDER', 'local');
    }

    async upload(buffer: Buffer, originalName: string, folder: StorageFolder): Promise<string> {
        const ext = path.extname(originalName).toLowerCase() || '.bin';
        const name = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
        const key = `${folder}/${name}`;

        try {
            switch (this.provider) {
                case 'oracle':
                    return await this.uploadToOracle(buffer, key);
                case 's3':
                    return await this.uploadToS3(buffer, key);
                default:
                    return await this.uploadToLocal(buffer, key);
            }
        } catch (err) {
            this.logger.error(`Upload failed [${this.provider}]: ${err}`);
            throw new InternalServerErrorException('File upload failed');
        }
    }

    // ── Local (development) ─────────────────────────────────────────────────

    private async uploadToLocal(buffer: Buffer, key: string): Promise<string> {
        const dir = path.join(process.cwd(), 'uploads', path.dirname(key));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(process.cwd(), 'uploads', key), buffer);
        // Return relative path — frontend prepends API base URL at render time
        return `/uploads/${key}`;
    }

    // ── Oracle Object Storage (Pre-Authenticated Request) ───────────────────

    private async uploadToOracle(buffer: Buffer, key: string): Promise<string> {
        const parUrl = this.config.get<string>('STORAGE_ORACLE_PAR_URL', '');
        if (!parUrl) {
            this.logger.warn('STORAGE_ORACLE_PAR_URL not set — falling back to local');
            return this.uploadToLocal(buffer, key);
        }
        const res = await fetch(`${parUrl.replace(/\/$/, '')}/${key}`, {
            method: 'PUT',
            body: buffer as unknown as BodyInit,
            headers: { 'Content-Type': 'application/octet-stream' },
        });
        if (!res.ok) {
            throw new Error(`Oracle OCS ${res.status}: ${res.statusText}`);
        }
        const pubBase = this.config.get<string>('STORAGE_PUBLIC_BASE_URL', parUrl);
        return `${pubBase.replace(/\/$/, '')}/${key}`;
    }

    // ── S3-compatible (Cloudflare R2, MinIO, AWS) ───────────────────────────
    // Uses AWS Signature Version 4 — no extra SDK required.

    private async uploadToS3(buffer: Buffer, key: string): Promise<string> {
        const endpoint = this.config.get<string>('STORAGE_S3_ENDPOINT', '');
        const bucket = this.config.get<string>('STORAGE_S3_BUCKET', '');
        const accessKeyId = this.config.get<string>('STORAGE_S3_ACCESS_KEY', '');
        const secretAccessKey = this.config.get<string>('STORAGE_S3_SECRET_KEY', '');
        const region = this.config.get<string>('STORAGE_S3_REGION', 'auto');
        const pubBase = this.config.get<string>('STORAGE_PUBLIC_BASE_URL', '');

        if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
            this.logger.warn('S3 credentials incomplete — falling back to local');
            return this.uploadToLocal(buffer, key);
        }

        const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
        const host = new URL(url).host;
        const now = new Date();
        const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '').slice(0, 15) + 'Z';
        const dateStamp = amzDate.slice(0, 8);
        const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

        const canonicalHeaders =
            `content-type:application/octet-stream\nhost:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = [
            'PUT',
            `/${bucket}/${key}`,
            '',
            canonicalHeaders,
            signedHeaders,
            contentHash,
        ].join('\n');

        const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
        ].join('\n');

        const hmac = (k: Buffer | string, d: string) =>
            crypto.createHmac('sha256', k).update(d).digest();
        const signingKey = hmac(
            hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 's3'),
            'aws4_request',
        );
        const signature = hmac(signingKey, stringToSign).toString('hex');
        const authorization =
            `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`;

        const res = await fetch(url, {
            method: 'PUT',
            body: buffer as unknown as BodyInit,
            headers: {
                'Content-Type': 'application/octet-stream',
                Host: host,
                'x-amz-content-sha256': contentHash,
                'x-amz-date': amzDate,
                Authorization: authorization,
            },
        });
        if (!res.ok) {
            throw new Error(`S3 ${res.status}: ${res.statusText}`);
        }
        return pubBase ? `${pubBase.replace(/\/$/, '')}/${key}` : url;
    }
}

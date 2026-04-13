import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PDPA Consent Management Service
 * Handles recording, querying, and revoking user consent
 */
@Injectable()
export class ConsentService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Record user consent (e.g., accepting privacy policy)
     */
    async recordConsent(params: {
        userId: string;
        consentType: string;
        version: string;
        ipAddress?: string;
    }) {
        // Revoke previous consent of same type if exists
        await this.prisma.consent.updateMany({
            where: {
                user_id: params.userId,
                consent_type: params.consentType,
                revoked_at: null,
            },
            data: { revoked_at: new Date() },
        });

        return this.prisma.consent.create({
            data: {
                user_id: params.userId,
                consent_type: params.consentType,
                granted: true,
                version: params.version,
                ip_address: params.ipAddress,
            },
        });
    }

    /**
     * Revoke user consent
     */
    async revokeConsent(userId: string, consentType: string) {
        return this.prisma.consent.updateMany({
            where: {
                user_id: userId,
                consent_type: consentType,
                revoked_at: null,
            },
            data: {
                granted: false,
                revoked_at: new Date(),
            },
        });
    }

    /**
     * Check if user has active consent for a specific type
     */
    async hasConsent(userId: string, consentType: string): Promise<boolean> {
        const consent = await this.prisma.consent.findFirst({
            where: {
                user_id: userId,
                consent_type: consentType,
                granted: true,
                revoked_at: null,
            },
        });
        return !!consent;
    }

    /**
     * Get all active consents for a user
     */
    async getConsentStatus(userId: string) {
        return this.prisma.consent.findMany({
            where: {
                user_id: userId,
                revoked_at: null,
            },
            orderBy: { granted_at: 'desc' },
        });
    }
}

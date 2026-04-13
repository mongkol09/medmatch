import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PDPA-compliant audit logging service
 * Logs all access and modifications to sensitive data
 */
@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Log data access (read operations on sensitive data)
     */
    async logAccess(params: {
        userId?: string;
        resource: string;
        resourceId?: string;
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, any>;
    }) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    user_id: params.userId,
                    action: 'read',
                    resource: params.resource,
                    resource_id: params.resourceId,
                    ip_address: params.ipAddress,
                    user_agent: params.userAgent,
                    details: params.details ?? undefined,
                },
            });
        } catch (error) {
            this.logger.error('Failed to create audit log', error);
        }
    }

    /**
     * Log data modification (create/update/delete)
     */
    async logModification(params: {
        userId?: string;
        action: 'create' | 'update' | 'delete';
        resource: string;
        resourceId?: string;
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, any>;
    }) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    user_id: params.userId,
                    action: params.action,
                    resource: params.resource,
                    resource_id: params.resourceId,
                    ip_address: params.ipAddress,
                    user_agent: params.userAgent,
                    details: params.details ?? undefined,
                },
            });
        } catch (error) {
            this.logger.error('Failed to create audit log', error);
        }
    }

    /**
     * Get audit trail for a specific user (PDPA compliance)
     */
    async getAuditTrail(
        userId: string,
        options?: { from?: Date; to?: Date; resource?: string; limit?: number },
    ) {
        return this.prisma.auditLog.findMany({
            where: {
                user_id: userId,
                ...(options?.resource && { resource: options.resource }),
                ...(options?.from || options?.to
                    ? {
                        created_at: {
                            ...(options?.from && { gte: options.from }),
                            ...(options?.to && { lte: options.to }),
                        },
                    }
                    : {}),
            },
            orderBy: { created_at: 'desc' },
            take: options?.limit ?? 100,
        });
    }
}

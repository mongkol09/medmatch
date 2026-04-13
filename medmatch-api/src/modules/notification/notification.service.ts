import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

export type NotifType =
    | 'JOB_MATCH'
    | 'JOB_ACCEPTED'
    | 'JOB_REJECTED'
    | 'NEW_MESSAGE'
    | 'BOOKING_CONFIRMED'
    | 'BOOKING_CANCELLED'
    | 'PAYMENT_VERIFIED'
    | 'NEW_REVIEW'
    | 'SYSTEM';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private firebaseReady = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        this.initFirebase();
    }

    private initFirebase() {
        if (admin.apps.length > 0) {
            this.firebaseReady = true;
            return;
        }
        const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
        if (!json) {
            this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
            return;
        }
        try {
            const serviceAccount = JSON.parse(json);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            this.firebaseReady = true;
        } catch (err) {
            this.logger.warn(`Firebase init failed: ${err}`);
        }
    }

    async create(params: {
        userId: string;
        type: NotifType;
        title: string;
        body: string;
        meta?: Record<string, any>;
    }) {
        try {
            const notif = await this.prisma.notification.create({
                data: {
                    user_id: params.userId,
                    type: params.type,
                    title: params.title,
                    body: params.body,
                    data: params.meta ?? {},
                    is_read: false,
                },
            });

            // Send FCM push if user has a registered device token
            if (this.firebaseReady) {
                const user = await this.prisma.user.findUnique({
                    where: { id: params.userId },
                    select: { fcm_token: true },
                });
                if (user?.fcm_token) {
                    await admin.messaging().send({
                        token: user.fcm_token,
                        notification: { title: params.title, body: params.body },
                        data: {
                            type: params.type,
                            ...(params.meta
                                ? Object.fromEntries(
                                    Object.entries(params.meta).map(([k, v]) => [k, String(v)]),
                                )
                                : {}),
                        },
                    }).catch((err: any) => {
                        this.logger.warn(`FCM send failed for ${params.userId}: ${err.message}`);
                    });
                }
            }

            return notif;
        } catch (err) {
            this.logger.warn(`Could not create notification: ${err}`);
            return null;
        }
    }

    async getForUser(userId: string, limit = 20, page = 1) {
        try {
            const skip = (page - 1) * limit;
            const [data, total] = await Promise.all([
                this.prisma.notification.findMany({
                    where: { user_id: userId },
                    orderBy: { created_at: 'desc' },
                    take: limit,
                    skip,
                }),
                this.prisma.notification.count({ where: { user_id: userId } }),
            ]);
            return { data, total, page, hasMore: skip + data.length < total };
        } catch {
            return { data: [], total: 0, page, hasMore: false };
        }
    }

    async markRead(notificationId: string) {
        try {
            return await this.prisma.notification.update({
                where: { id: notificationId },
                data: { is_read: true, read_at: new Date() },
            });
        } catch {
            return null;
        }
    }

    async markAllRead(userId: string) {
        try {
            return await this.prisma.notification.updateMany({
                where: { user_id: userId, is_read: false },
                data: { is_read: true, read_at: new Date() },
            });
        } catch {
            return { count: 0 };
        }
    }

    async getUnreadCount(userId: string): Promise<number> {
        try {
            return await this.prisma.notification.count({
                where: { user_id: userId, is_read: false },
            });
        } catch {
            return 0;
        }
    }
}

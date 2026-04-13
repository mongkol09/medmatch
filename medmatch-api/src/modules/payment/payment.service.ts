import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, PaymentMatchStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../security/audit-log.service';
import { SlipVerificationService } from './slip-verification.service';
import { StorageService } from '../../services/storage.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
        private readonly slipVerification: SlipVerificationService,
        private readonly storage: StorageService,
    ) { }

    /**
     * Create a payment record (upload slip)
     */
    async createPayment(params: {
        bookingId?: string;
        clinicId: string;
        patientId: string;
        amount: number;
        paymentMethod: PaymentMethod;
        slipImageUrl?: string;
        userId: string;
        ipAddress?: string;
    }) {
        const payment = await this.prisma.payment.create({
            data: {
                booking_id: params.bookingId,
                clinic_id: params.clinicId,
                patient_id: params.patientId,
                amount: params.amount,
                payment_method: params.paymentMethod,
                slip_image_url: params.slipImageUrl,
            },
        });

        // Audit log
        await this.auditLog.logModification({
            userId: params.userId,
            action: 'create',
            resource: 'payment',
            resourceId: payment.id,
            ipAddress: params.ipAddress,
            details: { amount: params.amount, method: params.paymentMethod },
        });

        return payment;
    }

    /**
     * Upload slip file, store it, run AI verification, and persist result.
     * This is the single-call entry point used by the mobile payment screen.
     */
    async uploadSlipAndVerify(params: {
        fileBuffer: Buffer;
        originalName: string;
        bookingId: string;
        clinicId: string;
        patientId: string;
        amount: number;
        userId: string;
        ipAddress?: string;
    }) {
        // 1. Persist the image
        const slipImageUrl = await this.storage.upload(
            params.fileBuffer,
            params.originalName,
            'slips',
        );

        // 2. Create the payment record (status = PENDING)
        const payment = await this.prisma.payment.create({
            data: {
                booking_id: params.bookingId,
                clinic_id: params.clinicId,
                patient_id: params.patientId,
                amount: params.amount,
                payment_method: PaymentMethod.TRANSFER,
                slip_image_url: slipImageUrl,
            },
        });

        // 3. Audit log
        await this.auditLog.logModification({
            userId: params.userId,
            action: 'create',
            resource: 'payment',
            resourceId: payment.id,
            ipAddress: params.ipAddress,
            details: { amount: params.amount, method: 'TRANSFER' },
        });

        // 4. Run AI verification asynchronously (do NOT await — respond fast)
        this.runAiVerification(payment.id, slipImageUrl, params.amount).catch(
            (err) =>
                this.logger.error(
                    `AI verification failed for payment ${payment.id}: ${err.message}`,
                ),
        );

        return { payment, slipImageUrl };
    }

    /**
     * Background AI verification — called after slip upload.
     */
    private async runAiVerification(
        paymentId: string,
        slipImageUrl: string,
        expectedAmount: number,
    ) {
        this.logger.log(`Starting AI slip verification for payment ${paymentId}`);
        const result = await this.slipVerification.verifySlip(
            slipImageUrl,
            expectedAmount,
        );

        const verified = result.decision === 'APPROVED';
        const matchStatus =
            result.decision === 'APPROVED'
                ? PaymentMatchStatus.MATCHED
                : result.decision === 'REJECTED'
                    ? PaymentMatchStatus.AMOUNT_MISMATCH
                    : PaymentMatchStatus.PENDING_REVIEW;

        await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                ai_verified: verified,
                ai_extracted_data: result.extracted as any,
                verified_by: 'AI',
                match_status: matchStatus,
                status: verified
                    ? PaymentStatus.VERIFIED
                    : result.decision === 'REJECTED'
                        ? PaymentStatus.REJECTED
                        : PaymentStatus.PENDING,
            },
        });

        // Auto-update booking payment status when approved
        if (verified) {
            const payment = await this.prisma.payment.findUnique({
                where: { id: paymentId },
                select: { booking_id: true },
            });
            if (payment?.booking_id) {
                await this.prisma.booking.update({
                    where: { id: payment.booking_id },
                    data: { payment_status: 'FULLY_PAID' },
                });
            }
        }

        this.logger.log(
            `AI slip verification done for ${paymentId}: ${result.decision} (confidence=${result.confidence.toFixed(2)})`,
        );
    }

    /**
     * Verify a payment slip (admin / AI)
     */
    async verifyPayment(
        paymentId: string,
        verified: boolean,
        verifiedBy: 'AI' | 'MANUAL' | 'ADMIN',
        aiExtractedData?: Record<string, any>,
    ) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { booking: true },
        });
        if (!payment) throw new NotFoundException('Payment not found');

        // Check amount matching
        let matchStatus: PaymentMatchStatus = PaymentMatchStatus.PENDING_REVIEW;
        if (aiExtractedData?.amount) {
            matchStatus =
                Math.abs(aiExtractedData.amount - payment.amount) < 1
                    ? PaymentMatchStatus.MATCHED
                    : PaymentMatchStatus.AMOUNT_MISMATCH;
        }

        // Update payment
        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                ai_verified: verifiedBy === 'AI' ? verified : payment.ai_verified,
                ai_extracted_data: aiExtractedData ?? undefined,
                verified_by: verifiedBy,
                match_status: matchStatus,
                status: verified ? PaymentStatus.VERIFIED : PaymentStatus.REJECTED,
            },
        });

        // Update booking payment status
        if (verified && payment.booking_id) {
            await this.prisma.booking.update({
                where: { id: payment.booking_id },
                data: { payment_status: 'FULLY_PAID' },
            });
        }

        return updated;
    }

    /**
     * Get payment history for a clinic
     */
    async getClinicPaymentHistory(
        clinicId: string,
        options?: { from?: Date; to?: Date; status?: PaymentStatus },
    ) {
        return this.prisma.payment.findMany({
            where: {
                clinic_id: clinicId,
                ...(options?.status && { status: options.status }),
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
        });
    }

    /**
     * Get daily accounting summary for a clinic
     */
    async getDailySummary(clinicId: string, date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const payments = await this.prisma.payment.findMany({
            where: {
                clinic_id: clinicId,
                status: PaymentStatus.VERIFIED,
                created_at: { gte: startOfDay, lte: endOfDay },
            },
        });

        const summary = {
            date,
            totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
            totalBookings: payments.length,
            cashAmount: payments
                .filter((p) => p.payment_method === PaymentMethod.CASH)
                .reduce((sum, p) => sum + p.amount, 0),
            transferAmount: payments
                .filter((p) => p.payment_method === PaymentMethod.TRANSFER)
                .reduce((sum, p) => sum + p.amount, 0),
        };

        // Upsert accounting summary
        await this.prisma.accountingSummary.upsert({
            where: {
                clinic_id_date: { clinic_id: clinicId, date: startOfDay },
            },
            update: {
                total_revenue: summary.totalRevenue,
                total_bookings: summary.totalBookings,
                cash_amount: summary.cashAmount,
                transfer_amount: summary.transferAmount,
            },
            create: {
                clinic_id: clinicId,
                date: startOfDay,
                total_revenue: summary.totalRevenue,
                total_bookings: summary.totalBookings,
                cash_amount: summary.cashAmount,
                transfer_amount: summary.transferAmount,
            },
        });

        return summary;
    }

    /**
     * Get monthly summary
     */
    async getMonthlySummary(clinicId: string, year: number, month: number) {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        const summaries = await this.prisma.accountingSummary.findMany({
            where: {
                clinic_id: clinicId,
                date: { gte: startOfMonth, lte: endOfMonth },
            },
            orderBy: { date: 'asc' },
        });

        return {
            year,
            month,
            dailySummaries: summaries,
            totals: {
                revenue: summaries.reduce((sum, s) => sum + s.total_revenue, 0),
                bookings: summaries.reduce((sum, s) => sum + s.total_bookings, 0),
                cash: summaries.reduce((sum, s) => sum + s.cash_amount, 0),
                transfer: summaries.reduce((sum, s) => sum + s.transfer_amount, 0),
            },
        };
    }
}

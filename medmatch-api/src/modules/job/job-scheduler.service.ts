import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobSchedulerService {
    private readonly logger = new Logger(JobSchedulerService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Runs every hour.
     * Marks OPEN jobs whose work_date has already passed as EXPIRED.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async expireOverdueJobs() {
        const result = await this.prisma.job.updateMany({
            where: {
                status: JobStatus.OPEN,
                work_date: { lt: new Date() },
            },
            data: { status: JobStatus.EXPIRED },
        });
        if (result.count > 0) {
            this.logger.log(`Auto-expired ${result.count} overdue job(s)`);
        }
    }

    /**
     * Runs daily at 02:00 server time.
     * Marks OPEN jobs where filled_slots >= slots as FILLED.
     * Uses raw SQL because Prisma doesn't support cross-column comparisons in `where`.
     */
    @Cron('0 2 * * *')
    async closeFilledJobs() {
        const affected = await this.prisma.$executeRaw`
            UPDATE "Job"
            SET    status = 'FILLED'::"JobStatus"
            WHERE  status = 'OPEN'::"JobStatus"
              AND  filled_slots >= slots
        `;
        if (affected > 0) {
            this.logger.log(`Auto-closed ${affected} fully-booked job(s)`);
        }
    }
}

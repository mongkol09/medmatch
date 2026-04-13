import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { Prisma, JobStatus, ApplicationStatus, MatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateJobDto, BrowseJobsDto } from './dto';

@Injectable()
export class JobService {
    private readonly logger = new Logger(JobService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Create a new job posting (clinic only)
     */
    async createJob(clinicProfileId: string, dto: CreateJobDto) {
        // Auto-use clinic's location if not provided in request
        let latitude = dto.latitude;
        let longitude = dto.longitude;
        if (latitude === undefined || longitude === undefined) {
            const clinic = await this.prisma.clinicProfile.findUnique({
                where: { id: clinicProfileId },
                select: { latitude: true, longitude: true },
            });
            latitude = clinic?.latitude ?? 13.7563;
            longitude = clinic?.longitude ?? 100.5018;
        }

        return this.prisma.job.create({
            data: {
                clinic_id: clinicProfileId,
                title: dto.title,
                description: dto.description,
                specialty_required: dto.specialtyRequired,
                work_date: new Date(dto.workDate),
                start_time: dto.startTime,
                end_time: dto.endTime,
                pay_amount: dto.payAmount,
                pay_negotiable: dto.payNegotiable ?? false,
                latitude,
                longitude,
                slots: dto.slots ?? 1,
                expires_at: new Date(dto.workDate),
            },
            include: { clinic: { select: { clinic_name: true, rating_avg: true } } },
        });
    }

    /**
     * Browse jobs with optional geospatial filtering.
     * - If latitude/longitude/radiusKm provided → filter by radius
     * - If latitude/longitude provided without radiusKm → default 10 km
     * - If no coordinates → nationwide search (no location filter)
     */
    async browseJobs(dto: BrowseJobsDto) {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;
        const offset = (page - 1) * limit;

        const hasLocation = dto.latitude != null && dto.longitude != null;
        const radiusKm = dto.radiusKm ?? 10;

        // Build where clause — location filter only when coordinates provided
        const where: Prisma.JobWhereInput = {
            status: JobStatus.OPEN,
            ...(dto.specialty && { specialty_required: dto.specialty }),
            ...(dto.date && { work_date: new Date(dto.date) }),
            ...(dto.minPay && { pay_amount: { gte: dto.minPay } }),
        };

        // Add bounding box filter when location is provided
        if (hasLocation) {
            const radiusDegrees = radiusKm / 111.32;
            where.latitude = {
                gte: dto.latitude! - radiusDegrees,
                lte: dto.latitude! + radiusDegrees,
            };
            where.longitude = {
                gte: dto.longitude! - radiusDegrees,
                lte: dto.longitude! + radiusDegrees,
            };
        }

        const [jobs, total] = await Promise.all([
            this.prisma.job.findMany({
                where,
                include: {
                    clinic: {
                        select: {
                            clinic_name: true,
                            address: true,
                            rating_avg: true,
                            images: true,
                        },
                    },
                    _count: { select: { applications: true } },
                },
                orderBy: this.getSortOrder(dto.sortBy),
                skip: offset,
                take: limit,
            }),
            this.prisma.job.count({ where }),
        ]);

        // Calculate distance for each job (if user has location)
        const jobsWithDistance = jobs.map((job) => ({
            ...job,
            distance_km: hasLocation
                ? this.haversineDistance(
                    dto.latitude!,
                    dto.longitude!,
                    job.latitude,
                    job.longitude,
                )
                : null,
        }));

        // Filter by exact Haversine radius only when location provided
        const filtered = hasLocation
            ? jobsWithDistance.filter((j) => (j.distance_km ?? 0) <= radiusKm)
            : jobsWithDistance;

        // Sort by distance if requested and location available
        if (dto.sortBy === 'distance' && hasLocation) {
            filtered.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
        }

        return {
            data: filtered,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Apply for a job (seeker swipes right)
     */
    async applyToJob(jobId: string, seekerProfileId: string) {
        const job = await this.prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.status !== JobStatus.OPEN) {
            throw new NotFoundException('Job not found or not open');
        }

        // Check if already applied
        const existing = await this.prisma.application.findUnique({
            where: {
                job_id_seeker_id: { job_id: jobId, seeker_id: seekerProfileId },
            },
        });
        if (existing) {
            throw new BadRequestException('Already applied to this job');
        }

        return this.prisma.application.create({
            data: {
                job_id: jobId,
                seeker_id: seekerProfileId,
                status: ApplicationStatus.PENDING,
            },
        });
    }

    /**
     * Accept an applicant → create a Match with SEEKER_PENDING status
     * Seeker must confirm before match is finalized
     */
    async acceptApplicant(applicationId: string, clinicProfileId: string) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: { job: true },
        });

        if (!application || application.job.clinic_id !== clinicProfileId) {
            throw new ForbiddenException('Not authorized');
        }

        if (application.job.filled_slots >= application.job.slots) {
            throw new BadRequestException('All slots are filled');
        }

        // Transaction: update application + create match (SEEKER_PENDING)
        // Do NOT increment filled_slots yet — wait for seeker confirmation
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.application.update({
                where: { id: applicationId },
                data: { status: ApplicationStatus.ACCEPTED },
            });

            const match = await tx.match.create({
                data: {
                    job_id: application.job_id,
                    seeker_id: application.seeker_id,
                    clinic_id: clinicProfileId,
                    status: MatchStatus.SEEKER_PENDING,
                },
            });

            return match;
        });

        // Send notification to seeker — ask them to confirm or decline
        try {
            const seekerProfile = await this.prisma.seekerProfile.findUnique({
                where: { id: application.seeker_id },
                select: { user_id: true },
            });
            if (seekerProfile) {
                await this.notificationService.create({
                    userId: seekerProfile.user_id,
                    type: 'JOB_ACCEPTED',
                    title: 'Job Offer Received!',
                    body: `Clinic wants you for "${application.job.title}". Please confirm or decline.`,
                    meta: { job_id: application.job_id, match_id: result.id },
                });
            }
        } catch (err) {
            this.logger.warn(`Failed to send JOB_ACCEPTED notification: ${err}`);
        }

        return result;
    }

    /**
     * Seeker confirms a match → finalize (increment filled_slots, auto-close if full)
     */
    async seekerConfirmMatch(matchId: string, seekerProfileId: string) {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            include: { job: true },
        });

        if (!match || match.seeker_id !== seekerProfileId) {
            throw new ForbiddenException('Not authorized');
        }
        if (match.status !== MatchStatus.SEEKER_PENDING) {
            throw new BadRequestException('Match is not pending confirmation');
        }

        // Transaction: confirm match + increment filled_slots + auto-close if full
        const result = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.match.update({
                where: { id: matchId },
                data: { status: MatchStatus.CONFIRMED },
            });

            const job = await tx.job.update({
                where: { id: match.job_id },
                data: {
                    filled_slots: { increment: 1 },
                },
            });

            // Auto-close job if all slots filled
            if (job.filled_slots >= job.slots) {
                await tx.job.update({
                    where: { id: match.job_id },
                    data: { status: JobStatus.FILLED },
                });
            }

            return updated;
        });

        // Notify the clinic
        try {
            const clinicProfile = await this.prisma.clinicProfile.findUnique({
                where: { id: match.clinic_id },
                select: { user_id: true },
            });
            if (clinicProfile) {
                await this.notificationService.create({
                    userId: clinicProfile.user_id,
                    type: 'JOB_MATCH',
                    title: 'Seeker Confirmed!',
                    body: `A provider has confirmed for "${match.job.title}".`,
                    meta: { job_id: match.job_id },
                });
            }
        } catch (err) {
            this.logger.warn(`Failed to send confirmation notification: ${err}`);
        }

        return result;
    }

    /**
     * Seeker declines a match → cancel and leave slot open
     */
    async seekerDeclineMatch(matchId: string, seekerProfileId: string) {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            include: { job: true },
        });

        if (!match || match.seeker_id !== seekerProfileId) {
            throw new ForbiddenException('Not authorized');
        }
        if (match.status !== MatchStatus.SEEKER_PENDING) {
            throw new BadRequestException('Match is not pending confirmation');
        }

        const result = await this.prisma.match.update({
            where: { id: matchId },
            data: { status: MatchStatus.CANCELLED },
        });

        // Notify the clinic that seeker declined
        try {
            const clinicProfile = await this.prisma.clinicProfile.findUnique({
                where: { id: match.clinic_id },
                select: { user_id: true },
            });
            if (clinicProfile) {
                await this.notificationService.create({
                    userId: clinicProfile.user_id,
                    type: 'JOB_MATCH',
                    title: 'Seeker Declined',
                    body: `A provider has declined the offer for "${match.job.title}". The slot is still open.`,
                    meta: { job_id: match.job_id },
                });
            }
        } catch (err) {
            this.logger.warn(`Failed to send decline notification: ${err}`);
        }

        return result;
    }

    /**
     * Reject an applicant
     */
    async rejectApplicant(applicationId: string, clinicProfileId: string) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: { job: true },
        });

        if (!application || application.job.clinic_id !== clinicProfileId) {
            throw new ForbiddenException('Not authorized');
        }

        const updated = await this.prisma.application.update({
            where: { id: applicationId },
            data: { status: ApplicationStatus.REJECTED },
        });

        // Send notification to seeker about rejection
        try {
            const seekerProfile = await this.prisma.seekerProfile.findUnique({
                where: { id: application.seeker_id },
                select: { user_id: true },
            });
            if (seekerProfile) {
                await this.notificationService.create({
                    userId: seekerProfile.user_id,
                    type: 'JOB_REJECTED',
                    title: 'Application Update',
                    body: `Your application for "${application.job.title}" was not selected.`,
                    meta: { job_id: application.job_id },
                });
            }
        } catch (err) {
            this.logger.warn(`Failed to send JOB_REJECTED notification: ${err}`);
        }

        return updated;
    }

    /**
     * Close a job manually
     */
    async closeJob(jobId: string, clinicProfileId: string) {
        const job = await this.prisma.job.findFirst({
            where: { id: jobId, clinic_id: clinicProfileId },
        });

        if (!job) throw new ForbiddenException('Not authorized');

        return this.prisma.job.update({
            where: { id: jobId },
            data: { status: JobStatus.FILLED },
        });
    }

    /**
     * Re-post a job from a previous posting (template)
     */
    async repostJob(jobId: string, clinicProfileId: string, newDate: string) {
        const original = await this.prisma.job.findFirst({
            where: { id: jobId, clinic_id: clinicProfileId },
        });

        if (!original) throw new ForbiddenException('Not authorized');

        return this.prisma.job.create({
            data: {
                clinic_id: clinicProfileId,
                title: original.title,
                description: original.description,
                specialty_required: original.specialty_required,
                work_date: new Date(newDate),
                start_time: original.start_time,
                end_time: original.end_time,
                pay_amount: original.pay_amount,
                pay_negotiable: original.pay_negotiable,
                latitude: original.latitude,
                longitude: original.longitude,
                slots: original.slots,
                expires_at: new Date(newDate),
            },
        });
    }

    /**
     * Get applicants for a job
     */
    async getApplicants(jobId: string, clinicProfileId: string) {
        const job = await this.prisma.job.findFirst({
            where: { id: jobId, clinic_id: clinicProfileId },
        });
        if (!job) throw new ForbiddenException('Not authorized');

        return this.prisma.application.findMany({
            where: { job_id: jobId },
            include: {
                seeker: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        license_type: true,
                        license_verified: true,
                        experience_years: true,
                        specialties: true,
                        profile_image_url: true,
                        rating_avg: true,
                        rating_count: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });
    }

    /**
     * Get my posted jobs (clinic)
     */
    async getMyJobs(clinicProfileId: string) {
        return this.prisma.job.findMany({
            where: { clinic_id: clinicProfileId },
            include: {
                _count: { select: { applications: true, matches: true } },
            },
            orderBy: { created_at: 'desc' },
        });
    }

    /**
     * Get my matches (seeker)
     */
    async getMyMatches(seekerProfileId: string) {
        return this.prisma.match.findMany({
            where: { seeker_id: seekerProfileId },
            include: {
                job: {
                    select: {
                        title: true,
                        work_date: true,
                        start_time: true,
                        end_time: true,
                        pay_amount: true,
                    },
                },
                clinic: {
                    select: {
                        id: true,
                        clinic_name: true,
                        address: true,
                        latitude: true,
                        longitude: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });
    }

    /**
     * Get my applications (seeker)
     */
    async getMyApplications(seekerProfileId: string) {
        return this.prisma.application.findMany({
            where: { seeker_id: seekerProfileId },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        work_date: true,
                        start_time: true,
                        end_time: true,
                        pay_amount: true,
                        pay_negotiable: true,
                        status: true,
                        clinic: {
                            select: {
                                clinic_name: true,
                                address: true,
                            },
                        },
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });
    }

    /**
     * Withdraw a pending application (seeker)
     */
    async withdrawApplication(applicationId: string, seekerProfileId: string) {
        const application = await this.prisma.application.findUnique({
            where: { id: applicationId },
        });
        if (!application || application.seeker_id !== seekerProfileId) {
            throw new ForbiddenException('Not authorized');
        }
        if (application.status !== 'PENDING') {
            throw new BadRequestException('Can only withdraw pending applications');
        }
        return this.prisma.application.update({
            where: { id: applicationId },
            data: { status: ApplicationStatus.CANCELLED },
        });
    }

    /**
     * Auto-expire jobs past their work date
     */
    async autoExpireJobs() {
        const result = await this.prisma.job.updateMany({
            where: {
                status: JobStatus.OPEN,
                work_date: { lt: new Date() },
            },
            data: { status: JobStatus.EXPIRED },
        });
        this.logger.log(`Auto-expired ${result.count} jobs`);
        return result;
    }

    /**
     * Get jobs for map view (within map bounds)
     */
    async getJobsInBounds(
        swLat: number,
        swLng: number,
        neLat: number,
        neLng: number,
    ) {
        return this.prisma.job.findMany({
            where: {
                status: JobStatus.OPEN,
                latitude: { gte: swLat, lte: neLat },
                longitude: { gte: swLng, lte: neLng },
            },
            select: {
                id: true,
                title: true,
                latitude: true,
                longitude: true,
                pay_amount: true,
                work_date: true,
                specialty_required: true,
                clinic: {
                    select: { clinic_name: true, rating_avg: true },
                },
            },
            take: 100,
        });
    }

    // --- Helpers ---

    private getSortOrder(
        sortBy?: string,
    ): Prisma.JobOrderByWithRelationInput {
        switch (sortBy) {
            case 'pay':
                return { pay_amount: 'desc' };
            case 'rating':
                return { clinic: { rating_avg: 'desc' } };
            case 'newest':
                return { created_at: 'desc' };
            default:
                return { created_at: 'desc' };
        }
    }

    /**
     * Haversine formula to calculate distance between two coordinates
     */
    private haversineDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 100) / 100; // Round to 2 decimals
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}

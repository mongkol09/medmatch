import { Test, TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { JobStatus, ApplicationStatus, MatchStatus } from '@prisma/client';
import { JobService } from '../job.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const makeNotificationService = () => ({
    create: jest.fn().mockResolvedValue(undefined),
});

const makePrisma = () => ({
    job: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    application: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    match: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    seekerProfile: {
        findUnique: jest.fn().mockResolvedValue({ user_id: 'seeker-user-uuid' }),
    },
    clinicProfile: {
        findUnique: jest.fn().mockResolvedValue({ user_id: 'clinic-user-uuid' }),
    },
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) => {
        const tx = {
            application: { update: jest.fn() },
            match: {
                create: jest.fn(() => Promise.resolve(MOCK_MATCH)),
                update: jest.fn(() => Promise.resolve({ ...MOCK_MATCH, status: MatchStatus.CONFIRMED })),
            },
            job: { update: jest.fn(() => Promise.resolve({ ...MOCK_JOB, filled_slots: 1 })) },
        };
        return fn(tx);
    }),
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const BASE_CREATE_DTO = {
    title: 'ทันตแพทย์ Part-time',
    specialtyRequired: 'DENTIST',
    workDate: FUTURE_DATE.toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    payAmount: 3000,
    latitude: 13.7563,
    longitude: 100.5018,
    slots: 1,
};

const MOCK_JOB = {
    id: 'job-uuid',
    clinic_id: 'clinic-uuid',
    status: JobStatus.OPEN,
    slots: 1,
    filled_slots: 0,
    latitude: 13.7563,
    longitude: 100.5018,
};

const MOCK_MATCH = {
    id: 'match-uuid',
    job_id: 'job-uuid',
    seeker_id: 'seeker-uuid',
    clinic_id: 'clinic-uuid',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('JobService', () => {
    let service: JobService;
    let prisma: ReturnType<typeof makePrisma>;
    let notificationService: ReturnType<typeof makeNotificationService>;

    beforeEach(async () => {
        prisma = makePrisma();
        notificationService = makeNotificationService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JobService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationService, useValue: notificationService },
            ],
        }).compile();

        service = module.get<JobService>(JobService);
    });

    // ── createJob ─────────────────────────────────────────────────────────────

    describe('createJob()', () => {
        it('creates a job with correct fields', async () => {
            prisma.job.create.mockResolvedValue({ ...MOCK_JOB, title: BASE_CREATE_DTO.title });

            const result = await service.createJob('clinic-uuid', BASE_CREATE_DTO as any);

            expect(prisma.job.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        clinic_id: 'clinic-uuid',
                        title: BASE_CREATE_DTO.title,
                        pay_amount: 3000,
                    }),
                }),
            );
            expect(result.id).toBe('job-uuid');
        });
    });

    // ── browseJobs ────────────────────────────────────────────────────────────

    describe('browseJobs()', () => {
        it('returns paginated job list with distance_km', async () => {
            prisma.job.findMany.mockResolvedValue([
                { ...MOCK_JOB, clinic: { clinic_name: 'Test Clinic', rating_avg: 4.5, images: [], address: 'BKK' }, _count: { applications: 0 } },
            ]);
            prisma.job.count.mockResolvedValue(1);

            const result = await service.browseJobs({
                latitude: 13.7563,
                longitude: 100.5018,
                radiusKm: 10,
            } as any);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toHaveProperty('distance_km');
            expect(result.meta.total).toBe(1);
        });

        it('filters out jobs beyond the radius', async () => {
            prisma.job.findMany.mockResolvedValue([
                {
                    ...MOCK_JOB,
                    // Chiang Mai — ~700 km from BKK
                    latitude: 18.7883,
                    longitude: 98.9853,
                    clinic: { clinic_name: 'Far Clinic', rating_avg: 3, images: [], address: 'CNX' },
                    _count: { applications: 0 },
                },
            ]);
            prisma.job.count.mockResolvedValue(1);

            const result = await service.browseJobs({
                latitude: 13.7563,
                longitude: 100.5018,
                radiusKm: 20,
            } as any);

            expect(result.data).toHaveLength(0); // filtered out
        });
    });

    // ── applyToJob ────────────────────────────────────────────────────────────

    describe('applyToJob()', () => {
        it('throws NotFoundException when job not found', async () => {
            prisma.job.findUnique.mockResolvedValue(null);
            await expect(service.applyToJob('no-job', 'seeker-uuid')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws NotFoundException when job is not OPEN', async () => {
            prisma.job.findUnique.mockResolvedValue({
                ...MOCK_JOB,
                status: JobStatus.EXPIRED,
            });
            await expect(service.applyToJob('job-uuid', 'seeker-uuid')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws BadRequestException when already applied', async () => {
            prisma.job.findUnique.mockResolvedValue(MOCK_JOB);
            prisma.application.findUnique.mockResolvedValue({
                id: 'app-uuid',
                status: ApplicationStatus.PENDING,
            });

            await expect(service.applyToJob('job-uuid', 'seeker-uuid')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('creates an application on success', async () => {
            prisma.job.findUnique.mockResolvedValue(MOCK_JOB);
            prisma.application.findUnique.mockResolvedValue(null);
            prisma.application.create.mockResolvedValue({
                id: 'app-uuid',
                job_id: 'job-uuid',
                seeker_id: 'seeker-uuid',
                status: ApplicationStatus.PENDING,
            });

            const result = await service.applyToJob('job-uuid', 'seeker-uuid');

            expect(prisma.application.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        job_id: 'job-uuid',
                        seeker_id: 'seeker-uuid',
                        status: ApplicationStatus.PENDING,
                    }),
                }),
            );
            expect(result.id).toBe('app-uuid');
        });
    });

    // ── acceptApplicant ───────────────────────────────────────────────────────

    describe('acceptApplicant()', () => {
        it('throws ForbiddenException when clinic does not own the job', async () => {
            prisma.application.findUnique.mockResolvedValue({
                id: 'app-uuid',
                job_id: 'job-uuid',
                seeker_id: 'seeker-uuid',
                job: { ...MOCK_JOB, clinic_id: 'OTHER-clinic' },
            });

            await expect(
                service.acceptApplicant('app-uuid', 'clinic-uuid'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws BadRequestException when all slots already filled', async () => {
            prisma.application.findUnique.mockResolvedValue({
                id: 'app-uuid',
                job_id: 'job-uuid',
                seeker_id: 'seeker-uuid',
                job: { ...MOCK_JOB, filled_slots: 1, slots: 1 }, // full
            });

            await expect(
                service.acceptApplicant('app-uuid', 'clinic-uuid'),
            ).rejects.toThrow(BadRequestException);
        });

        it('creates match with SEEKER_PENDING status in transaction on success', async () => {
            prisma.application.findUnique.mockResolvedValue({
                id: 'app-uuid',
                job_id: 'job-uuid',
                seeker_id: 'seeker-uuid',
                job: { ...MOCK_JOB, clinic_id: 'clinic-uuid', filled_slots: 0, slots: 1, title: 'Test Job' },
            });

            const result = await service.acceptApplicant('app-uuid', 'clinic-uuid');

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({ id: 'match-uuid' });
        });
    });

    // ── seekerConfirmMatch ───────────────────────────────────────────────────

    describe('seekerConfirmMatch()', () => {
        it('throws ForbiddenException when seeker does not own the match', async () => {
            prisma.match.findUnique.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.SEEKER_PENDING,
                seeker_id: 'OTHER-seeker',
                job: MOCK_JOB,
            });

            await expect(
                service.seekerConfirmMatch('match-uuid', 'seeker-uuid'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws BadRequestException when match is not SEEKER_PENDING', async () => {
            prisma.match.findUnique.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.CONFIRMED,
                job: MOCK_JOB,
            });

            await expect(
                service.seekerConfirmMatch('match-uuid', 'seeker-uuid'),
            ).rejects.toThrow(BadRequestException);
        });

        it('confirms match and increments filled_slots on success', async () => {
            prisma.match.findUnique.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.SEEKER_PENDING,
                job: { ...MOCK_JOB, title: 'Test Job' },
            });

            const result = await service.seekerConfirmMatch('match-uuid', 'seeker-uuid');

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({ status: MatchStatus.CONFIRMED });
        });
    });

    // ── seekerDeclineMatch ───────────────────────────────────────────────────

    describe('seekerDeclineMatch()', () => {
        it('throws ForbiddenException when seeker does not own the match', async () => {
            prisma.match.findUnique.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.SEEKER_PENDING,
                seeker_id: 'OTHER-seeker',
                job: MOCK_JOB,
            });

            await expect(
                service.seekerDeclineMatch('match-uuid', 'seeker-uuid'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws BadRequestException when match is not SEEKER_PENDING', async () => {
            prisma.match.findUnique.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.CONFIRMED,
                job: MOCK_JOB,
            });

            await expect(
                service.seekerDeclineMatch('match-uuid', 'seeker-uuid'),
            ).rejects.toThrow(BadRequestException);
        });

        it('cancels match on success', async () => {
            prisma.match.findUnique.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.SEEKER_PENDING,
                job: { ...MOCK_JOB, title: 'Test Job' },
            });
            prisma.match.update.mockResolvedValue({
                ...MOCK_MATCH,
                status: MatchStatus.CANCELLED,
            });

            const result = await service.seekerDeclineMatch('match-uuid', 'seeker-uuid');

            expect(prisma.match.update).toHaveBeenCalledWith({
                where: { id: 'match-uuid' },
                data: { status: MatchStatus.CANCELLED },
            });
            expect(result.status).toBe(MatchStatus.CANCELLED);
        });
    });
});

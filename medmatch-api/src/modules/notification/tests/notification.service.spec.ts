import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification.service';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Mock firebase-admin (module-level) ──────────────────────────────────────
// jest.mock is hoisted before variable declarations, so we cannot reference
// const variables inside the factory. Use module-scope state via a closure instead.

jest.mock('firebase-admin', () => {
    const send = jest.fn().mockResolvedValue('msg-id');
    const messaging = jest.fn(() => ({ send }));
    return {
        // Start with empty apps — tests that need firebaseReady=true flip the flag directly
        get apps() { return (global as any).__fbApps__ ?? []; },
        set apps(v: unknown[]) { (global as any).__fbApps__ = v; },
        initializeApp: jest.fn(),
        credential: { cert: jest.fn((sa: unknown) => sa) },
        messaging,
        __send: send,
    };
});

import * as admin from 'firebase-admin';
const mockSend: jest.Mock = (admin as any).__send;

// ─── Mock factories ───────────────────────────────────────────────────────────

const makePrisma = () => ({
    notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
});

const makeConfig = (overrides: Record<string, string | undefined> = {}) => ({
    get: jest.fn((key: string) => overrides[key]),
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOTIF_PARAMS = {
    userId: 'user-uuid',
    type: 'BOOKING_CONFIRMED' as const,
    title: 'Booking confirmed',
    body: 'Your appointment is set for tomorrow',
};

const MOCK_NOTIF = {
    id: 'notif-uuid',
    ...NOTIF_PARAMS,
    is_read: false,
    created_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
    let service: NotificationService;
    let prisma: ReturnType<typeof makePrisma>;

    // Helper: build module with optional Firebase key configured
    async function buildModule(
        configOverrides: Record<string, string | undefined> = {},
    ) {
        prisma = makePrisma();
        // Reset global firebase apps so initFirebase thinks it starts fresh
        (global as any).__fbApps__ = [];

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationService,
                { provide: PrismaService, useValue: prisma },
                { provide: ConfigService, useValue: makeConfig(configOverrides) },
            ],
        }).compile();

        service = module.get<NotificationService>(NotificationService);
        return service;
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ── create() — DB record always written ───────────────────────────────────

    describe('create()', () => {
        it('stores a notification record in the DB', async () => {
            await buildModule(); // no Firebase key
            prisma.notification.create.mockResolvedValue(MOCK_NOTIF);
            prisma.user.findUnique.mockResolvedValue({ fcm_token: null });

            const result = await service.create(NOTIF_PARAMS);

            expect(prisma.notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        user_id: 'user-uuid',
                        title: NOTIF_PARAMS.title,
                        body: NOTIF_PARAMS.body,
                        type: NOTIF_PARAMS.type,
                        is_read: false,
                    }),
                }),
            );
            expect(result?.id).toBe('notif-uuid');
        });

        it('does NOT call FCM when firebaseReady is false (no key configured)', async () => {
            await buildModule(); // no FIREBASE_SERVICE_ACCOUNT_JSON
            prisma.notification.create.mockResolvedValue(MOCK_NOTIF);
            prisma.user.findUnique.mockResolvedValue({ fcm_token: 'device-token' });

            await service.create(NOTIF_PARAMS);

            expect(mockSend).not.toHaveBeenCalled();
        });

        it('calls FCM when firebaseReady is true and user has fcm_token', async () => {
            await buildModule({
                FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
                    type: 'service_account',
                    project_id: 'test',
                }),
            });

            // Manually set firebaseReady because initFirebase() checks admin.apps.length
            // which is mocked. Set it directly to simulate initialised state.
            // @ts-ignore
            service['firebaseReady'] = true;

            prisma.notification.create.mockResolvedValue(MOCK_NOTIF);
            prisma.user.findUnique.mockResolvedValue({ fcm_token: 'device-token-abc' });

            await service.create(NOTIF_PARAMS);

            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: 'device-token-abc',
                    notification: expect.objectContaining({
                        title: NOTIF_PARAMS.title,
                        body: NOTIF_PARAMS.body,
                    }),
                }),
            );
        });

        it('does NOT call FCM when user has no fcm_token', async () => {
            await buildModule();
            // @ts-ignore
            service['firebaseReady'] = true;
            prisma.notification.create.mockResolvedValue(MOCK_NOTIF);
            prisma.user.findUnique.mockResolvedValue({ fcm_token: null });

            await service.create(NOTIF_PARAMS);

            expect(mockSend).not.toHaveBeenCalled();
        });
    });
});

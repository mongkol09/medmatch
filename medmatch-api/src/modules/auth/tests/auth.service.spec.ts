import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
    ConflictException,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../security/encryption.service';
import { AuditLogService } from '../../../security/audit-log.service';

// ─── Mock factories ──────────────────────────────────────────────────────────

const makePrisma = () => ({
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    otpCode: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
});

const makeEncryption = () => ({
    hashForLookup: jest.fn((v: string) => `hash:${v}`),
    encrypt: jest.fn((v: string) => Buffer.from(v)),
    decrypt: jest.fn((b: Buffer) => b.toString()),
    hashPassword: jest.fn(() => Promise.resolve('$hashed$')),
    verifyPassword: jest.fn(() => Promise.resolve(true)),
    generateSecureToken: jest.fn().mockReturnValue('secure-refresh-token'),
});

const makeAuditLog = () => ({
    logModification: jest.fn(),
    logAccess: jest.fn(),
});

const makeJwt = () => ({
    sign: jest.fn().mockReturnValue('mock-access-token'),
    verify: jest.fn(),
});

const makeConfig = () => ({
    get: jest.fn((key: string, def?: any) => {
        const map: Record<string, any> = {
            JWT_ACCESS_EXPIRES_IN: '15m',
            JWT_REFRESH_EXPIRES_IN: '7d',
            JWT_REFRESH_SECRET: 'refresh-secret',
        };
        return map[key] ?? def;
    }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
    id: 'user-uuid',
    role: UserRole.PATIENT,
    is_active: true,
    is_verified: true,
    password_hash: '$hashed$',
    phone_hash: 'hash:0812345678',
    email_hash: 'hash:user@test.com',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
    let service: AuthService;
    let prisma: ReturnType<typeof makePrisma>;
    let encryption: ReturnType<typeof makeEncryption>;
    let auditLog: ReturnType<typeof makeAuditLog>;

    beforeEach(async () => {
        prisma = makePrisma();
        encryption = makeEncryption();
        auditLog = makeAuditLog();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: prisma },
                { provide: EncryptionService, useValue: encryption },
                { provide: AuditLogService, useValue: auditLog },
                { provide: JwtService, useValue: makeJwt() },
                { provide: ConfigService, useValue: makeConfig() },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    // ── register ─────────────────────────────────────────────────────────────

    describe('register()', () => {
        it('throws BadRequestException when neither phone nor email given', async () => {
            await expect(
                service.register({ password: 'pass', role: UserRole.PATIENT } as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws ConflictException when email already registered', async () => {
            prisma.user.findUnique.mockResolvedValue(MOCK_USER);
            await expect(
                service.register({ email: 'user@test.com', password: 'pass', role: UserRole.PATIENT }),
            ).rejects.toThrow(ConflictException);
        });

        it('creates user with is_verified=false and sends OTP', async () => {
            prisma.user.findUnique.mockResolvedValue(null); // no existing
            prisma.user.create.mockResolvedValue({ ...MOCK_USER, id: 'new-id', is_verified: false });
            prisma.otpCode.upsert.mockResolvedValue({});

            const result = await service.register({
                email: 'new@test.com',
                password: 'StrongPass1!',
                role: UserRole.PATIENT,
            });

            expect(result).toMatchObject({ userId: 'new-id' });
            expect(prisma.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ is_verified: false }),
                }),
            );
            expect(prisma.otpCode.upsert).toHaveBeenCalledTimes(1);
        });
    });

    // ── login ─────────────────────────────────────────────────────────────────

    describe('login()', () => {
        it('throws BadRequestException when neither phone nor email given', async () => {
            await expect(
                service.login({ password: 'pass' } as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws UnauthorizedException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(
                service.login({ email: 'ghost@test.com', password: 'pass' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when account not verified', async () => {
            prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, is_verified: false });
            await expect(
                service.login({ email: 'user@test.com', password: 'pass' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when password invalid', async () => {
            prisma.user.findUnique.mockResolvedValue(MOCK_USER);
            encryption.verifyPassword.mockResolvedValue(false);
            await expect(
                service.login({ email: 'user@test.com', password: 'wrong' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('returns tokens + user info on success', async () => {
            prisma.user.findUnique.mockResolvedValue(MOCK_USER);
            prisma.refreshToken.create.mockResolvedValue({});

            const result = await service.login({ email: 'user@test.com', password: 'pass' });

            expect(result).toMatchObject({
                accessToken: 'mock-access-token',
                user: { id: 'user-uuid', role: UserRole.PATIENT },
            });
            expect(auditLog.logAccess).toHaveBeenCalledTimes(1);
        });

        it('looks up user by phone hash when phone provided', async () => {
            prisma.user.findUnique.mockResolvedValue(MOCK_USER);
            prisma.refreshToken.create.mockResolvedValue({});

            await service.login({ phone: '0812345678', password: 'pass' });

            expect(prisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { phone_hash: 'hash:0812345678' } }),
            );
        });
    });

    // ── sendOtp ───────────────────────────────────────────────────────────────

    describe('sendOtp()', () => {
        it('upserts an OTP record for the user', async () => {
            prisma.otpCode.upsert.mockResolvedValue({});
            await service.sendOtp('user-uuid');
            expect(prisma.otpCode.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { user_id: 'user-uuid' },
                    create: expect.objectContaining({ user_id: 'user-uuid' }),
                }),
            );
        });
    });

    // ── verifyOtp ─────────────────────────────────────────────────────────────

    describe('verifyOtp()', () => {
        const makeOtpRecord = (overrides: Partial<any> = {}) => ({
            user_id: 'user-uuid',
            code_hash: 'hash:123456',
            expires_at: new Date(Date.now() + 600_000),
            used: false,
            user: MOCK_USER,
            ...overrides,
        });

        it('throws UnauthorizedException when OTP not found', async () => {
            prisma.otpCode.findUnique.mockResolvedValue(null);
            await expect(service.verifyOtp('user-uuid', '123456')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('throws UnauthorizedException when OTP already used', async () => {
            prisma.otpCode.findUnique.mockResolvedValue(makeOtpRecord({ used: true }));
            await expect(service.verifyOtp('user-uuid', '123456')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('throws UnauthorizedException when OTP expired', async () => {
            prisma.otpCode.findUnique.mockResolvedValue(
                makeOtpRecord({ expires_at: new Date(Date.now() - 1000) }),
            );
            await expect(service.verifyOtp('user-uuid', '123456')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('throws UnauthorizedException when code hash mismatch', async () => {
            prisma.otpCode.findUnique.mockResolvedValue(
                makeOtpRecord({ code_hash: 'hash:WRONG' }),
            );
            await expect(service.verifyOtp('user-uuid', '123456')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('returns tokens and marks OTP used + user verified on success', async () => {
            prisma.otpCode.findUnique.mockResolvedValue(makeOtpRecord());
            prisma.otpCode.update.mockResolvedValue({});
            prisma.user.update.mockResolvedValue({});
            prisma.refreshToken.create.mockResolvedValue({});

            const result = await service.verifyOtp('user-uuid', '123456');

            expect(result).toMatchObject({ accessToken: 'mock-access-token' });
            expect(prisma.otpCode.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { used: true } }),
            );
            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { is_verified: true } }),
            );
        });
    });

    // ── refreshToken ──────────────────────────────────────────────────────────

    describe('refreshToken()', () => {
        it('throws UnauthorizedException when token not found', async () => {
            prisma.refreshToken.findUnique.mockResolvedValue(null);
            await expect(
                service.refreshToken({ refreshToken: 'bad-token' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when token revoked', async () => {
            prisma.refreshToken.findUnique.mockResolvedValue({
                id: 't1', revoked: true, expires_at: new Date(Date.now() + 1000), user: MOCK_USER,
            });
            await expect(
                service.refreshToken({ refreshToken: 'revoked' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('revokes old token and issues new token pair', async () => {
            prisma.refreshToken.findUnique.mockResolvedValue({
                id: 't1', revoked: false, expires_at: new Date(Date.now() + 1000), user: MOCK_USER,
            });
            prisma.refreshToken.update.mockResolvedValue({});
            prisma.refreshToken.create.mockResolvedValue({});

            const result = await service.refreshToken({ refreshToken: 'valid-token' });

            expect(result.accessToken).toBe('mock-access-token');
            expect(prisma.refreshToken.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { revoked: true } }),
            );
        });
    });
});

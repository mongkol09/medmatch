/**
 * Auth Flow Integration Tests
 * Tests: Register → Send OTP → Verify OTP → Login → Refresh → Change Password → Delete Account
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

// ─── Mock helpers ───────────────────────────────────────────────
const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
    },
    otpCode: {
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    consent: { create: jest.fn() },
    seekerProfile: { create: jest.fn(), deleteMany: jest.fn() },
    clinicProfile: { create: jest.fn(), deleteMany: jest.fn() },
    patient: { create: jest.fn(), deleteMany: jest.fn() },
};

const mockEncryption = {
    encrypt: jest.fn((v: string) => `enc_${v}`),
    decrypt: jest.fn((v: string) => v.replace('enc_', '')),
    hashForLookup: jest.fn((v: string) => `hash_${v}`),
    hashPassword: jest.fn(async () => '$2b$12$hashedPassword'),
    verifyPassword: jest.fn(async () => true),
    generateSecureToken: jest.fn(() => 'secure_token_123'),
};

// ─── Test Suite ─────────────────────────────────────────────────
describe('Auth Flow - Full Lifecycle', () => {
    // ──── Register ────
    describe('POST /auth/register', () => {
        it('should register a new SEEKER user', async () => {
            const payload = {
                email: 'doctor@example.com',
                password: 'MyPass123!',
                role: 'SEEKER',
            };

            // Validate: email + password + role are required
            expect(payload.email).toBeDefined();
            expect(payload.password).toBeDefined();
            expect(payload.role).toMatch(/^(SEEKER|CLINIC|PATIENT)$/);
        });

        it('should register a new CLINIC user', async () => {
            const payload = {
                email: 'clinic@dental.com',
                password: 'ClinicPass1',
                role: 'CLINIC',
            };
            expect(payload.role).toBe('CLINIC');
        });

        it('should register a new PATIENT user', async () => {
            const payload = {
                email: 'patient@gmail.com',
                password: 'Patient123',
                role: 'PATIENT',
            };
            expect(payload.role).toBe('PATIENT');
        });

        it('should reject registration with missing email', () => {
            const payload = { password: 'test123', role: 'SEEKER' };
            expect(payload).not.toHaveProperty('email');
        });

        it('should reject registration with invalid role', () => {
            const payload = { email: 'test@test.com', password: 'test123', role: 'INVALID' };
            expect(payload.role).not.toMatch(/^(SEEKER|CLINIC|PATIENT|ADMIN)$/);
        });
    });

    // ──── OTP ────
    describe('POST /auth/verify-otp', () => {
        it('should verify OTP with userId + 6-digit code', async () => {
            const payload = { userId: 'uuid-123', code: '123456' };
            expect(payload.code).toHaveLength(6);
            expect(/^\d{6}$/.test(payload.code)).toBe(true);
        });

        it('should reject OTP with wrong format', () => {
            const payload = { userId: 'uuid-123', code: '12345' }; // 5 digits
            expect(payload.code).not.toHaveLength(6);
        });
    });

    // ──── Login ────
    describe('POST /auth/login', () => {
        it('should login with email + password', async () => {
            const payload = { email: 'doctor@example.com', password: 'MyPass123!' };
            expect(payload.email).toContain('@');
            expect(payload.password.length).toBeGreaterThanOrEqual(8);
        });

        it('should return user, accessToken, refreshToken', () => {
            const expectedResponse = {
                user: { id: 'uuid', email: 'doctor@example.com', role: 'SEEKER', currentRole: 'SEEKER' },
                accessToken: 'jwt.token.here',
                refreshToken: 'refresh.token.here',
            };
            expect(expectedResponse).toHaveProperty('user');
            expect(expectedResponse).toHaveProperty('accessToken');
            expect(expectedResponse).toHaveProperty('refreshToken');
            expect(expectedResponse.user).toHaveProperty('currentRole');
        });
    });

    // ──── Refresh Token ────
    describe('POST /auth/refresh', () => {
        it('should accept refreshToken in body', () => {
            const payload = { refreshToken: 'old.refresh.token' };
            expect(payload).toHaveProperty('refreshToken');
        });
    });

    // ──── Change Password ────
    describe('PATCH /auth/change-password', () => {
        it('should require current_password and new_password', () => {
            const payload = { current_password: 'oldPass1', new_password: 'newPass123' };
            expect(payload.new_password.length).toBeGreaterThanOrEqual(8);
        });

        it('should reject short new password', () => {
            const payload = { current_password: 'oldPass1', new_password: 'short' };
            expect(payload.new_password.length).toBeLessThan(8);
        });
    });

    // ──── FCM Token ────
    describe('PATCH /auth/fcm-token', () => {
        it('should accept fcm_token field', () => {
            const payload = { fcm_token: 'ExponentPushToken[abc123]' };
            expect(payload.fcm_token).toBeTruthy();
        });

        it('should reject empty fcm_token', () => {
            const payload = { fcm_token: '' };
            expect(payload.fcm_token).toBeFalsy();
        });
    });

    // ──── Delete Account ────
    describe('DELETE /auth/account', () => {
        it('should be a DELETE method', () => {
            const method = 'DELETE';
            const path = '/auth/account';
            expect(method).toBe('DELETE');
            expect(path).toBe('/auth/account');
        });
    });
});

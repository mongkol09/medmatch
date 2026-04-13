import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { AuditLogService } from '../../security/audit-log.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';

export interface JwtPayload {
    sub: string; // user id
    role: UserRole;
    iat?: number;
    exp?: number;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly encryption: EncryptionService,
        private readonly auditLog: AuditLogService,
    ) { }

    /**
     * Register a new user. Returns userId so mobile can proceed to OTP verification.
     */
    async register(
        dto: RegisterDto,
        ipAddress?: string,
    ): Promise<{ userId: string; message: string }> {
        if (!dto.phone && !dto.email) {
            throw new BadRequestException('Phone or email is required');
        }

        // Check phone uniqueness
        if (dto.phone) {
            const phoneHash = this.encryption.hashForLookup(dto.phone);
            const existing = await this.prisma.user.findUnique({ where: { phone_hash: phoneHash } });
            if (existing) throw new ConflictException('Phone number already registered');
        }

        // Check email uniqueness
        let emailHash: string | undefined;
        if (dto.email) {
            emailHash = this.encryption.hashForLookup(dto.email);
            const existingEmail = await this.prisma.user.findUnique({ where: { email_hash: emailHash } });
            if (existingEmail) throw new ConflictException('Email already registered');
        }

        // Encrypt PII
        const phoneHash = dto.phone ? this.encryption.hashForLookup(dto.phone) : undefined;
        const phoneEnc = dto.phone ? this.encryption.encrypt(dto.phone) : undefined;
        const emailEnc = dto.email ? this.encryption.encrypt(dto.email) : undefined;
        const passwordHash = await this.encryption.hashPassword(dto.password);

        const user = await this.prisma.user.create({
            data: {
                phone_enc: phoneEnc ?? undefined,
                phone_hash: phoneHash ?? undefined,
                email_enc: emailEnc ?? undefined,
                email_hash: emailHash ?? undefined,
                password_hash: passwordHash,
                role: dto.role,
                firebase_uid: dto.firebaseUid,
                is_verified: false,
            },
        });

        await this.auditLog.logModification({
            userId: user.id,
            action: 'create',
            resource: 'user',
            resourceId: user.id,
            ipAddress,
        });

        await this.sendOtp(user.id);

        return { userId: user.id, message: 'Verification code sent. Please check your email or phone.' };
    }

    /**
     * Login with email or phone + password. Returns tokens + user info.
     */
    async login(dto: LoginDto, ipAddress?: string): Promise<AuthTokens & { user: { id: string; role: UserRole; currentRole: UserRole } }> {
        if (!dto.phone && !dto.email) {
            throw new BadRequestException('Phone or email is required');
        }

        let user: any = null;
        if (dto.phone) {
            const phoneHash = this.encryption.hashForLookup(dto.phone);
            user = await this.prisma.user.findUnique({ where: { phone_hash: phoneHash } });
        } else if (dto.email) {
            const emailHash = this.encryption.hashForLookup(dto.email);
            user = await this.prisma.user.findUnique({ where: { email_hash: emailHash } });
        }

        if (!user || !user.is_active) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.is_verified) {
            throw new UnauthorizedException('Account not verified. Please complete OTP verification.');
        }

        const isPasswordValid = await this.encryption.verifyPassword(
            dto.password,
            user.password_hash,
        );
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        await this.auditLog.logAccess({
            userId: user.id,
            resource: 'auth',
            details: { action: 'login' },
            ipAddress,
        });

        const tokens = await this.generateTokens(user.id, user.role);
        return {
            ...tokens,
            user: { id: user.id, role: user.role, currentRole: user.role },
        };
    }

    /**
     * Generate and store a 6-digit OTP for the given user
     */
    async sendOtp(userId: string): Promise<void> {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = this.encryption.hashForLookup(code);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await this.prisma.otpCode.upsert({
            where: { user_id: userId },
            create: { user_id: userId, code_hash: codeHash, expires_at: expiresAt },
            update: { code_hash: codeHash, expires_at: expiresAt, used: false },
        });

        // In production: send via email/SMS service
        // In development: log to console for easy testing
        this.logger.log(`[DEV] OTP for user ${userId}: ${code}`);
    }

    /**
     * Verify OTP code and return full auth tokens
     */
    async verifyOtp(
        userId: string,
        code: string,
    ): Promise<AuthTokens & { user: { id: string; role: UserRole; currentRole: UserRole } }> {
        const codeHash = this.encryption.hashForLookup(code);

        const otpRecord = await this.prisma.otpCode.findUnique({
            where: { user_id: userId },
            include: { user: true },
        });

        if (!otpRecord || otpRecord.used || otpRecord.expires_at < new Date()) {
            throw new UnauthorizedException('Invalid or expired verification code');
        }

        if (otpRecord.code_hash !== codeHash) {
            throw new UnauthorizedException('Incorrect verification code');
        }

        await Promise.all([
            this.prisma.otpCode.update({
                where: { user_id: userId },
                data: { used: true },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { is_verified: true },
            }),
        ]);

        const tokens = await this.generateTokens(userId, otpRecord.user.role);
        return {
            ...tokens,
            user: { id: userId, role: otpRecord.user.role, currentRole: otpRecord.user.role },
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(dto: RefreshTokenDto): Promise<AuthTokens> {
        const tokenHash = this.encryption.hashForLookup(dto.refreshToken);

        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token_hash: tokenHash },
            include: { user: true },
        });

        if (!storedToken || storedToken.revoked || storedToken.expires_at < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        // Revoke old token
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revoked: true },
        });

        // Issue new token pair
        return this.generateTokens(storedToken.user.id, storedToken.user.role);
    }

    /**
     * Logout — revoke refresh token
     */
    async logout(userId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { user_id: userId, revoked: false },
            data: { revoked: true },
        });
    }

    /**
     * Switch between SEEKER and PATIENT roles
     */
    async switchRole(
        userId: string,
        newRole: UserRole,
    ): Promise<AuthTokens> {
        if (newRole !== UserRole.SEEKER && newRole !== UserRole.PATIENT) {
            throw new ForbiddenException('Can only switch between SEEKER and PATIENT');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Update role
        await this.prisma.user.update({
            where: { id: userId },
            data: { role: newRole },
        });

        // Issue new tokens with updated role
        return this.generateTokens(userId, newRole);
    }

    /**
     * Delete user account (PDPA Right to Delete)
     */
    async deleteAccount(userId: string, ipAddress?: string): Promise<void> {
        await this.auditLog.logModification({
            userId,
            action: 'delete',
            resource: 'user',
            resourceId: userId,
            ipAddress,
            details: { reason: 'user_requested_deletion' },
        });

        // Soft delete — anonymize PII
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                is_active: false,
                phone_enc: null,
                phone_hash: `deleted_${userId}`,
                email_enc: null,
                email_hash: null,
                firebase_uid: null,
            },
        });
    }

    /**
     * Generate JWT access + refresh token pair
     */
    private async generateTokens(
        userId: string,
        role: UserRole,
    ): Promise<AuthTokens> {
        const payload: JwtPayload = { sub: userId, role };

        const accessToken = this.jwt.sign(payload, {
            expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
        });

        const refreshToken = this.encryption.generateSecureToken();
        const refreshTokenHash = this.encryption.hashForLookup(refreshToken);

        // Store refresh token
        await this.prisma.refreshToken.create({
            data: {
                user_id: userId,
                token_hash: refreshTokenHash,
                expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                ),
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes in seconds
        };
    }
}

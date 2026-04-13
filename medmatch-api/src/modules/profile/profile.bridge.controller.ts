/**
 * ProfileBridgeController
 * Maps the routes the mobile client uses (/profile/*) to the underlying
 * Seeker / Clinic / Patient profile logic stored in profile.controller.ts.
 * Also adds:
 *   - POST /profile/upload-image              – multi-part image upload to object storage
 *   - GET  /profile/seeker/verification-status
 *   - POST /profile/seeker/verify             – submit license for review
 *   - PATCH /profile/admin/seeker/:userId/verify – admin approve/reject license
 */
import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    NotFoundException,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { AuditLogService } from '../../security/audit-log.service';
import { StorageService, StorageFolder } from '../../services/storage.service';

@ApiTags('Profile (Bridge)')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfileBridgeController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
        private readonly auditLog: AuditLogService,
        private readonly storage: StorageService,
    ) { }

    // ─────────────────────────────────────────────
    // SEEKER
    // ─────────────────────────────────────────────

    /** Mask a license number for display: "ท.12345678" → "ท.****5678" */
    private maskLicense(raw: string): string {
        if (!raw || raw.length <= 4) return raw;
        const prefix = raw.replace(/\d.*/, '');          // keep non-digit prefix (e.g. "ท.")
        const digits = raw.slice(prefix.length);
        const visible = digits.slice(-4);
        return `${prefix}${'*'.repeat(Math.max(0, digits.length - 4))}${visible}`;
    }

    /**
     * GET /profile/seeker/me
     * - Default: license number is masked (e.g. ท.****9999) — safe for profile display
     * - Add ?reveal=true to get the full number — for the Edit Profile screen only
     */
    @Get('seeker/me')
    @ApiOperation({ summary: "Get current user's seeker profile" })
    async getSeekerMe(
        @CurrentUser() user: JwtPayload,
        @Query('reveal') reveal?: string,
    ) {
        const profile = await this.prisma.seekerProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!profile) throw new NotFoundException('Seeker profile not found');
        const rawLicense = this.encryption.decrypt(profile.license_number_enc);
        const displayLicense = reveal === 'true' ? rawLicense : this.maskLicense(rawLicense);
        return {
            ...profile,
            full_name: `${profile.first_name} ${profile.last_name}`.trim(),
            license_number: displayLicense,
            years_experience: profile.experience_years,
            average_rating: profile.rating_avg,
            review_count: profile.rating_count,
            phone: (profile as any).phone ?? null,
            line_id: (profile as any).line_id ?? null,
            license_number_enc: undefined,
            license_number_hash: undefined,
        };
    }

    @Put('seeker')
    @ApiOperation({ summary: 'Upsert seeker profile' })
    async upsertSeeker(
        @CurrentUser() user: JwtPayload,
        @Body() body: {
            full_name?: string;
            specialty?: string;
            license_number?: string;
            years_experience?: number;
            bio?: string;
            skills?: string[];
            phone?: string;
            line_id?: string;
            profile_image_url?: string;
        },
    ) {
        const nameParts = (body.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const existing = await this.prisma.seekerProfile.findUnique({ where: { user_id: user.sub } });

        const licenseEnc = body.license_number
            ? this.encryption.encrypt(body.license_number)
            : existing?.license_number_enc;
        const licenseHash = body.license_number
            ? this.encryption.hashForLookup(body.license_number)
            : existing?.license_number_hash;

        const data: any = {
            ...(firstName && { first_name: firstName }),
            ...(lastName !== undefined && { last_name: lastName }),
            ...(body.specialty && { license_type: body.specialty as any }),
            ...(licenseEnc && { license_number_enc: licenseEnc }),
            ...(licenseHash && { license_number_hash: licenseHash }),
            ...(body.years_experience !== undefined && { experience_years: body.years_experience }),
            ...(body.bio !== undefined && { bio: body.bio }),
            ...(body.skills && { specialties: body.skills }),
            ...(body.profile_image_url && { profile_image_url: body.profile_image_url }),
            ...(body.phone !== undefined && { phone: body.phone }),
            ...(body.line_id !== undefined && { line_id: body.line_id }),
        };

        if (!existing) {
            return this.prisma.seekerProfile.create({
                data: { user_id: user.sub, ...data },
            });
        }
        return this.prisma.seekerProfile.update({ where: { user_id: user.sub }, data });
    }

    @Get('seeker/verification-status')
    @ApiOperation({ summary: 'Get license verification status' })
    async getVerificationStatus(@CurrentUser() user: JwtPayload) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { user_id: user.sub } });
        if (!profile) return { status: 'NOT_SUBMITTED' };

        let status: string;
        if (!profile.license_image_url) status = 'NOT_SUBMITTED';
        else if (profile.license_verified) status = 'APPROVED';
        else if (profile.license_rejection_reason) status = 'REJECTED';
        else status = 'PENDING';

        return {
            status,
            license_image_url: profile.license_image_url ?? null,
            rejection_reason: profile.license_rejection_reason ?? null,
        };
    }

    @Get('seeker/:id')
    @ApiOperation({ summary: 'Get seeker profile by ID (public view for clinics)' })
    async getSeekerById(@Param('id') id: string) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { id } });
        if (!profile) throw new NotFoundException('Seeker profile not found');
        return {
            id: profile.id,
            full_name: `${profile.first_name} ${profile.last_name}`.trim(),
            specialty: profile.license_type,
            years_experience: profile.experience_years,
            bio: profile.bio,
            specialties: profile.specialties,
            average_rating: profile.rating_avg,
            review_count: profile.rating_count,
            profile_image_url: profile.profile_image_url,
            is_verified: profile.license_verified,
        };
    }

    @Post('seeker/verify')
    @UseInterceptors(FileInterceptor('license'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Submit license document for verification' })
    async submitVerification(
        @CurrentUser() user: JwtPayload,
        @UploadedFile() file: Express.Multer.File,
        @Body('document_type') documentType: string,
    ) {
        if (!file) throw new BadRequestException('License file is required');

        const url = await this.storage.upload(file.buffer, file.originalname, 'licenses');

        await this.prisma.seekerProfile.upsert({
            where: { user_id: user.sub },
            create: {
                user: { connect: { id: user.sub } },
                first_name: '',
                last_name: '',
                license_number_enc: Buffer.alloc(0),
                license_number_hash: '',
                license_image_url: url,
                license_type: documentType as any,
            },
            update: {
                license_image_url: url,
                license_verified: false,
                license_rejection_reason: null,
                license_type: documentType as any,
            },
        });

        return { message: 'Submitted for review', status: 'PENDING' };
    }

    // ─────────────────────────────────────────────
    // ADMIN: License Review
    // ─────────────────────────────────────────────

    @Patch('admin/seeker/:userId/verify')
    @ApiOperation({ summary: '(Admin) Approve or reject a seeker license' })
    async adminReviewLicense(
        @CurrentUser() admin: JwtPayload,
        @Param('userId') userId: string,
        @Body() body: { approved: boolean; rejectionReason?: string },
    ) {
        if (admin.role !== UserRole.ADMIN) {
            throw new BadRequestException('Admin access required');
        }
        const profile = await this.prisma.seekerProfile.findUnique({ where: { user_id: userId } });
        if (!profile) throw new NotFoundException('Seeker profile not found');

        await this.prisma.seekerProfile.update({
            where: { user_id: userId },
            data: {
                license_verified: body.approved,
                license_rejection_reason: body.approved
                    ? null
                    : (body.rejectionReason ?? 'Rejected by admin'),
            },
        });

        await this.auditLog.logModification({
            userId: admin.sub,
            action: 'update',
            resource: 'seeker_license',
            resourceId: userId,
            details: { approved: body.approved, reason: body.rejectionReason },
        });

        return {
            status: body.approved ? 'APPROVED' : 'REJECTED',
            message: body.approved ? 'License approved' : 'License rejected',
        };
    }

    // ─────────────────────────────────────────────
    // CLINIC
    // ─────────────────────────────────────────────

    @Get('clinic/me')
    @ApiOperation({ summary: "Get current user's clinic profile" })
    async getClinicMe(@CurrentUser() user: JwtPayload) {
        const profile = await this.prisma.clinicProfile.findUnique({ where: { user_id: user.sub } });
        if (!profile) throw new NotFoundException('Clinic profile not found');
        return {
            ...profile,
            phone: profile.phone_enc ? this.encryption.decrypt(profile.phone_enc) : null,
            phone_enc: undefined,
            average_rating: profile.rating_avg,
            review_count: profile.rating_count,
        };
    }

    @Get('clinic/:id')
    @ApiOperation({ summary: 'Get a clinic profile by ID (public)' })
    async getClinicById(@Param('id') id: string) {
        const profile = await this.prisma.clinicProfile.findUnique({ where: { id } });
        if (!profile) throw new NotFoundException('Clinic not found');
        return {
            ...profile,
            average_rating: profile.rating_avg,
            review_count: profile.rating_count,
        };
    }

    @Put('clinic')
    @ApiOperation({ summary: 'Upsert clinic profile' })
    async upsertClinic(
        @CurrentUser() user: JwtPayload,
        @Body() body: {
            clinic_name?: string;
            license_number?: string;
            address?: string;
            latitude?: number;
            longitude?: number;
            phone?: string;
            description?: string;
            chair_count?: number;
            consultation_fee?: number;
            bank_name?: string;
            bank_account?: string;
            line_oa?: string;
            facilities?: string[];
            images?: string[];
        },
    ) {
        const data: any = {
            ...(body.clinic_name && { clinic_name: body.clinic_name }),
            ...(body.license_number && { license_number: body.license_number }),
            ...(body.address && { address: body.address }),
            ...(body.latitude !== undefined && { latitude: body.latitude }),
            ...(body.longitude !== undefined && { longitude: body.longitude }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.images && { images: body.images }),
            ...(body.chair_count !== undefined && { chair_count: body.chair_count }),
            ...(body.consultation_fee !== undefined && { consultation_fee: body.consultation_fee }),
            ...(body.bank_name !== undefined && { bank_name: body.bank_name }),
            ...(body.bank_account !== undefined && { bank_account: body.bank_account }),
            ...(body.line_oa !== undefined && { line_oa: body.line_oa }),
            ...(body.facilities && { parking_info: body.facilities.join(',') }),
        };

        if (body.phone !== undefined) {
            data.phone_enc = body.phone ? this.encryption.encrypt(body.phone) : null;
        }

        const existing = await this.prisma.clinicProfile.findUnique({ where: { user_id: user.sub } });
        if (!existing) {
            return this.prisma.clinicProfile.create({
                data: { user_id: user.sub, clinic_name: body.clinic_name || '', address: body.address || '', ...data },
            });
        }
        return this.prisma.clinicProfile.update({ where: { user_id: user.sub }, data });
    }

    // ─────────────────────────────────────────────
    // PATIENT
    // ─────────────────────────────────────────────

    @Get('patient/me')
    @ApiOperation({ summary: "Get current user's patient profile (decrypted)" })
    async getPatientMe(@CurrentUser() user: JwtPayload) {
        const profile = await this.prisma.patient.findUnique({ where: { user_id: user.sub } });
        if (!profile) throw new NotFoundException('Patient profile not found');

        await this.auditLog.logAccess({ userId: user.sub, resource: 'patient_profile', resourceId: profile.id });

        return {
            id: profile.id,
            full_name: `${this.encryption.decrypt(profile.first_name_enc)} ${this.encryption.decrypt(profile.last_name_enc)}`.trim(),
            phone: profile.phone_enc ? this.encryption.decrypt(profile.phone_enc) : null,
            blood_type: null, // extend schema if needed
            allergies: profile.allergies_enc ? this.encryption.decrypt(profile.allergies_enc) : null,
            medical_notes: profile.medical_notes_enc ? this.encryption.decrypt(profile.medical_notes_enc) : null,
            profile_image_url: profile.profile_image_url ?? null,
        };
    }

    @Put('patient')
    @ApiOperation({ summary: 'Upsert patient profile' })
    async upsertPatient(
        @CurrentUser() user: JwtPayload,
        @Body() body: {
            full_name?: string;
            phone?: string;
            date_of_birth?: string;
            allergies?: string;
            medical_notes?: string;
            profile_image_url?: string;
        },
    ) {
        const nameParts = (body.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const data: any = {
            ...(firstName && { first_name_enc: this.encryption.encrypt(firstName) }),
            ...(lastName && { last_name_enc: this.encryption.encrypt(lastName) }),
            ...(body.phone !== undefined && { phone_enc: this.encryption.encrypt(body.phone) }),
            ...(body.date_of_birth !== undefined && { dob_enc: this.encryption.encrypt(body.date_of_birth) }),
            ...(body.allergies !== undefined && { allergies_enc: this.encryption.encrypt(body.allergies) }),
            ...(body.medical_notes !== undefined && { medical_notes_enc: this.encryption.encrypt(body.medical_notes) }),
            ...(body.profile_image_url && { profile_image_url: body.profile_image_url }),
        };

        const existing = await this.prisma.patient.findUnique({ where: { user_id: user.sub } });
        if (!existing) {
            return this.prisma.patient.create({
                data: {
                    user_id: user.sub,
                    first_name_enc: this.encryption.encrypt(firstName || 'Patient'),
                    last_name_enc: this.encryption.encrypt(lastName),
                    ...data,
                },
            });
        }
        await this.prisma.patient.update({ where: { user_id: user.sub }, data });

        await this.auditLog.logModification({
            userId: user.sub,
            action: 'update',
            resource: 'patient_profile',
            resourceId: existing.id,
            details: { fields: Object.keys(body).filter((k) => (body as any)[k] !== undefined) },
        });

        return { message: 'Patient profile updated' };
    }

    // ─────────────────────────────────────────────
    // SHARED: Image Upload
    // ─────────────────────────────────────────────

    @Post('upload-image')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload a profile/clinic image — returns {url}' })
    async uploadImage(
        @CurrentUser() user: JwtPayload,
        @UploadedFile() file: Express.Multer.File,
        @Query('folder') folder: StorageFolder = 'profiles',
    ) {
        if (!file) throw new BadRequestException('No file uploaded');
        const url = await this.storage.upload(file.buffer, file.originalname, folder);
        return { url };
    }
}

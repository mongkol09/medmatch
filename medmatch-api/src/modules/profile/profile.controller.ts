import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { AuditLogService } from '../../security/audit-log.service';

@ApiTags('Profile — Seeker')
@Controller('seekers')
export class SeekerProfileController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
        private readonly auditLog: AuditLogService,
    ) { }

    @Post('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create seeker profile' })
    async createProfile(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            firstName: string;
            lastName: string;
            licenseNumber: string;
            licenseType: string;
            experienceYears?: number;
            specialties?: string[];
            bio?: string;
        },
    ) {
        const licenseEnc = this.encryption.encrypt(body.licenseNumber);
        const licenseHash = this.encryption.hashForLookup(body.licenseNumber);

        return this.prisma.seekerProfile.create({
            data: {
                user_id: user.sub,
                first_name: body.firstName,
                last_name: body.lastName,
                license_number_enc: licenseEnc,
                license_number_hash: licenseHash,
                license_type: body.licenseType as any,
                experience_years: body.experienceYears ?? 0,
                specialties: body.specialties ?? [],
                bio: body.bio,
            },
        });
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my seeker profile' })
    async getProfile(@CurrentUser() user: JwtPayload) {
        const profile = await this.prisma.seekerProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!profile) throw new NotFoundException('Profile not found');

        return {
            ...profile,
            license_number: this.encryption.decrypt(profile.license_number_enc),
            license_number_enc: undefined,
            license_number_hash: undefined,
        };
    }

    @Get(':id/public')
    @ApiOperation({ summary: 'Get public profile of a seeker' })
    async getPublicProfile(@Param('id') seekerId: string) {
        const profile = await this.prisma.seekerProfile.findUnique({
            where: { id: seekerId },
            include: {
                work_history: {
                    include: {
                        clinic: { select: { clinic_name: true } },
                    },
                    orderBy: { start_date: 'desc' },
                },
                certificates: {
                    where: { is_verified: true },
                    select: { name: true, issuer: true, issue_date: true },
                },
            },
        });
        if (!profile) throw new NotFoundException('Profile not found');

        // Return public data only (no encrypted fields)
        return {
            id: profile.id,
            firstName: profile.first_name,
            lastName: profile.last_name,
            licenseType: profile.license_type,
            licenseVerified: profile.license_verified,
            experienceYears: profile.experience_years,
            specialties: profile.specialties,
            profileImageUrl: profile.profile_image_url,
            bio: profile.bio,
            ratingAvg: profile.rating_avg,
            ratingCount: profile.rating_count,
            workHistory: profile.work_history,
            certificates: profile.certificates,
        };
    }

    @Put('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update seeker profile' })
    async updateProfile(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            firstName?: string;
            lastName?: string;
            experienceYears?: number;
            specialties?: string[];
            bio?: string;
            profileImageUrl?: string;
        },
    ) {
        return this.prisma.seekerProfile.update({
            where: { user_id: user.sub },
            data: {
                ...(body.firstName && { first_name: body.firstName }),
                ...(body.lastName && { last_name: body.lastName }),
                ...(body.experienceYears !== undefined && {
                    experience_years: body.experienceYears,
                }),
                ...(body.specialties && { specialties: body.specialties }),
                ...(body.bio !== undefined && { bio: body.bio }),
                ...(body.profileImageUrl && { profile_image_url: body.profileImageUrl }),
            },
        });
    }
}

@ApiTags('Profile — Clinic')
@Controller('clinics')
export class ClinicProfileController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
    ) { }

    @Post('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create clinic profile' })
    async createProfile(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            clinicName: string;
            address: string;
            latitude: number;
            longitude: number;
            licenseNumber?: string;
            description?: string;
            equipmentInfo?: string;
            parkingInfo?: string;
            benefits?: string;
            phone?: string;
        },
    ) {
        return this.prisma.clinicProfile.create({
            data: {
                user_id: user.sub,
                clinic_name: body.clinicName,
                address: body.address,
                latitude: body.latitude,
                longitude: body.longitude,
                license_number: body.licenseNumber,
                description: body.description,
                equipment_info: body.equipmentInfo,
                parking_info: body.parkingInfo,
                benefits: body.benefits,
                phone_enc: body.phone
                    ? this.encryption.encrypt(body.phone)
                    : undefined,
            },
        });
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my clinic profile' })
    async getProfile(@CurrentUser() user: JwtPayload) {
        const profile = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!profile) throw new NotFoundException('Profile not found');
        return profile;
    }

    @Get(':id/public')
    @ApiOperation({ summary: 'Get public clinic profile' })
    async getPublicProfile(@Param('id') clinicId: string) {
        const profile = await this.prisma.clinicProfile.findUnique({
            where: { id: clinicId },
            include: {
                clinic_services: {
                    where: { is_active: true },
                    select: {
                        id: true,
                        name: true,
                        duration_minutes: true,
                        price: true,
                        price_negotiable: true,
                        description: true,
                    },
                },
            },
        });
        if (!profile) throw new NotFoundException('Clinic not found');

        return {
            id: profile.id,
            clinicName: profile.clinic_name,
            address: profile.address,
            latitude: profile.latitude,
            longitude: profile.longitude,
            images: profile.images,
            description: profile.description,
            equipmentInfo: profile.equipment_info,
            parkingInfo: profile.parking_info,
            benefits: profile.benefits,
            ratingAvg: profile.rating_avg,
            ratingCount: profile.rating_count,
            services: profile.clinic_services,
        };
    }

    @Put('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update clinic profile' })
    async updateProfile(
        @CurrentUser() user: JwtPayload,
        @Body() body: Record<string, any>,
    ) {
        const updateData: any = {};
        if (body.clinicName) updateData.clinic_name = body.clinicName;
        if (body.address) updateData.address = body.address;
        if (body.latitude) updateData.latitude = body.latitude;
        if (body.longitude) updateData.longitude = body.longitude;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.equipmentInfo !== undefined) updateData.equipment_info = body.equipmentInfo;
        if (body.parkingInfo !== undefined) updateData.parking_info = body.parkingInfo;
        if (body.benefits !== undefined) updateData.benefits = body.benefits;
        if (body.images) updateData.images = body.images;

        return this.prisma.clinicProfile.update({
            where: { user_id: user.sub },
            data: updateData,
        });
    }

    @Put('profile/location')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Set clinic location (pin on map)' })
    async setLocation(
        @CurrentUser() user: JwtPayload,
        @Body() body: { latitude: number; longitude: number; address?: string },
    ) {
        return this.prisma.clinicProfile.update({
            where: { user_id: user.sub },
            data: {
                latitude: body.latitude,
                longitude: body.longitude,
                ...(body.address && { address: body.address }),
            },
        });
    }

    @Get('nearby')
    @ApiOperation({ summary: 'Find nearby clinics' })
    async findNearby(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            latitude: number;
            longitude: number;
            radiusKm?: number;
        },
    ) {
        const radiusKm = body.radiusKm ?? 10;
        const radiusDeg = radiusKm / 111.32;

        return this.prisma.clinicProfile.findMany({
            where: {
                latitude: { gte: body.latitude - radiusDeg, lte: body.latitude + radiusDeg },
                longitude: { gte: body.longitude - radiusDeg, lte: body.longitude + radiusDeg },
            },
            select: {
                id: true,
                clinic_name: true,
                address: true,
                latitude: true,
                longitude: true,
                images: true,
                rating_avg: true,
                rating_count: true,
                description: true,
            },
            take: 50,
        });
    }
}

@ApiTags('Profile — Patient')
@Controller('patients')
export class PatientProfileController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
        private readonly auditLog: AuditLogService,
    ) { }

    @Post('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.PATIENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create patient profile' })
    async createProfile(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            firstName: string;
            lastName: string;
            phone?: string;
            dateOfBirth?: string;
            drugAllergies?: string;
            medicalNotes?: string;
        },
    ) {
        return this.prisma.patient.create({
            data: {
                user_id: user.sub,
                first_name_enc: this.encryption.encrypt(body.firstName),
                last_name_enc: this.encryption.encrypt(body.lastName),
                phone_enc: body.phone
                    ? this.encryption.encrypt(body.phone)
                    : undefined,
                dob_enc: body.dateOfBirth
                    ? this.encryption.encrypt(body.dateOfBirth)
                    : undefined,
                allergies_enc: body.drugAllergies
                    ? this.encryption.encrypt(body.drugAllergies)
                    : undefined,
                medical_notes_enc: body.medicalNotes
                    ? this.encryption.encrypt(body.medicalNotes)
                    : undefined,
            },
        });
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.PATIENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my patient profile (decrypted)' })
    async getProfile(@CurrentUser() user: JwtPayload) {
        const profile = await this.prisma.patient.findUnique({
            where: { user_id: user.sub },
        });
        if (!profile) throw new NotFoundException('Profile not found');

        // Audit log — accessing medical data
        await this.auditLog.logAccess({
            userId: user.sub,
            resource: 'patient_profile',
            resourceId: profile.id,
        });

        return {
            id: profile.id,
            firstName: this.encryption.decrypt(profile.first_name_enc),
            lastName: this.encryption.decrypt(profile.last_name_enc),
            phone: profile.phone_enc
                ? this.encryption.decrypt(profile.phone_enc)
                : null,
            dateOfBirth: profile.dob_enc
                ? this.encryption.decrypt(profile.dob_enc)
                : null,
            drugAllergies: profile.allergies_enc
                ? this.encryption.decrypt(profile.allergies_enc)
                : null,
            medicalNotes: profile.medical_notes_enc
                ? this.encryption.decrypt(profile.medical_notes_enc)
                : null,
            profileImageUrl: profile.profile_image_url,
        };
    }

    @Put('medical-info')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.PATIENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update medical info (encrypted)' })
    async updateMedicalInfo(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            drugAllergies?: string;
            medicalNotes?: string;
        },
    ) {
        await this.auditLog.logModification({
            userId: user.sub,
            action: 'update',
            resource: 'patient_medical_info',
        });

        return this.prisma.patient.update({
            where: { user_id: user.sub },
            data: {
                ...(body.drugAllergies !== undefined && {
                    allergies_enc: this.encryption.encrypt(body.drugAllergies),
                }),
                ...(body.medicalNotes !== undefined && {
                    medical_notes_enc: this.encryption.encrypt(body.medicalNotes),
                }),
            },
        });
    }
}

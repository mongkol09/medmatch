import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JobService } from './job.service';
import { CreateJobDto, BrowseJobsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Jobs')
@Controller('jobs')
export class JobController {
    constructor(
        private readonly jobService: JobService,
        private readonly prisma: PrismaService,
    ) { }

    // =====================
    // CLINIC ENDPOINTS
    // =====================

    @Post()
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create new job posting (clinic only)' })
    async createJob(@CurrentUser() user: JwtPayload, @Body() dto: CreateJobDto) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.createJob(profile.id, dto);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Edit a job posting (clinic only)' })
    async editJob(
        @CurrentUser() user: JwtPayload,
        @Param('id') jobId: string,
        @Body() body: {
            title?: string;
            specialtyRequired?: string;
            workDate?: string;
            startTime?: string;
            endTime?: string;
            payAmount?: number;
            isNegotiable?: boolean;
            slotsNeeded?: number;
            requirements?: string;
            benefits?: string;
        },
    ) {
        const job = await this.prisma.job.findUnique({ where: { id: jobId } });
        if (!job) throw new NotFoundException('Job not found');

        // Verify ownership via clinic profile
        const clinic = await this.prisma.clinicProfile.findUnique({ where: { user_id: user.sub } });
        if (!clinic || job.clinic_id !== clinic.id) {
            throw new BadRequestException('You can only edit your own jobs');
        }
        if (job.status !== 'OPEN') {
            throw new BadRequestException('Only OPEN jobs can be edited');
        }

        return this.prisma.job.update({
            where: { id: jobId },
            data: {
                ...(body.title && { title: body.title }),
                ...(body.specialtyRequired && { specialty_required: body.specialtyRequired as any }),
                ...(body.workDate && { work_date: new Date(body.workDate) }),
                ...(body.startTime && { start_time: body.startTime }),
                ...(body.endTime && { end_time: body.endTime }),
                ...(body.payAmount !== undefined && { pay_amount: body.payAmount }),
                ...(body.isNegotiable !== undefined && { pay_negotiable: body.isNegotiable }),
                ...(body.slotsNeeded !== undefined && { slots: body.slotsNeeded }),
                ...(body.requirements !== undefined && { description: body.requirements }),
                // benefits not a Job field — stored in description
            },
        });
    }

    @Post(':id/close')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Close a job (got enough applicants)' })
    async closeJob(@CurrentUser() user: JwtPayload, @Param('id') jobId: string) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.closeJob(jobId, profile.id);
    }

    @Post(':id/repost')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Re-post a job from template' })
    async repostJob(
        @CurrentUser() user: JwtPayload,
        @Param('id') jobId: string,
        @Body('newDate') newDate: string,
    ) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.repostJob(jobId, profile.id, newDate);
    }

    @Get('my')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my posted jobs (clinic)' })
    async getMyJobs(@CurrentUser() user: JwtPayload) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.getMyJobs(profile.id);
    }

    // =====================
    // SEEKER ENDPOINTS
    // =====================

    @Get('browse')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Browse jobs with filters (seeker)' })
    async browseJobs(@Query() dto: BrowseJobsDto) {
        return this.jobService.browseJobs(dto);
    }

    @Get('browse/map')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get jobs for map view (within bounds)' })
    async browseJobsMap(
        @Query('swLat') swLat: string,
        @Query('swLng') swLng: string,
        @Query('neLat') neLat: string,
        @Query('neLng') neLng: string,
    ) {
        return this.jobService.getJobsInBounds(
            parseFloat(swLat),
            parseFloat(swLng),
            parseFloat(neLat),
            parseFloat(neLng),
        );
    }

    @Get('my-applications')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my job applications (seeker)' })
    async getMyApplications(@CurrentUser() user: JwtPayload) {
        const profile = await this.getSeekerProfile(user.sub);
        return this.jobService.getMyApplications(profile.id);
    }

    @Post('applications/:id/withdraw')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Withdraw a pending application (seeker)' })
    async withdrawApplication(
        @CurrentUser() user: JwtPayload,
        @Param('id') applicationId: string,
    ) {
        const profile = await this.getSeekerProfile(user.sub);
        return this.jobService.withdrawApplication(applicationId, profile.id);
    }

    @Post('matches/:id/confirm')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Seeker confirms a match' })
    async seekerConfirmMatch(
        @CurrentUser() user: JwtPayload,
        @Param('id') matchId: string,
    ) {
        const profile = await this.getSeekerProfile(user.sub);
        return this.jobService.seekerConfirmMatch(matchId, profile.id);
    }

    @Post('matches/:id/decline')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Seeker declines a match' })
    async seekerDeclineMatch(
        @CurrentUser() user: JwtPayload,
        @Param('id') matchId: string,
    ) {
        const profile = await this.getSeekerProfile(user.sub);
        return this.jobService.seekerDeclineMatch(matchId, profile.id);
    }

    @Get('matches')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my matches (seeker)' })
    async getMyMatches(@CurrentUser() user: JwtPayload) {
        const profile = await this.getSeekerProfile(user.sub);
        return this.jobService.getMyMatches(profile.id);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a single job by ID' })
    async getJobById(@Param('id') jobId: string) {
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
            include: {
                clinic: {
                    select: {
                        id: true,
                        clinic_name: true,
                        address: true,
                        images: true,
                        latitude: true,
                        longitude: true,
                    },
                },
            },
        });
        if (!job) throw new NotFoundException('Job not found');
        return job;
    }

    @Get(':id/applicants')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get applicants for a job' })
    async getApplicants(
        @CurrentUser() user: JwtPayload,
        @Param('id') jobId: string,
    ) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.getApplicants(jobId, profile.id);
    }

    @Post('applicants/:id/accept')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Accept an applicant → Create Match' })
    async acceptApplicant(
        @CurrentUser() user: JwtPayload,
        @Param('id') applicationId: string,
    ) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.acceptApplicant(applicationId, profile.id);
    }

    @Post('applicants/:id/reject')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.CLINIC)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Reject an applicant' })
    async rejectApplicant(
        @CurrentUser() user: JwtPayload,
        @Param('id') applicationId: string,
    ) {
        const profile = await this.getClinicProfile(user.sub);
        return this.jobService.rejectApplicant(applicationId, profile.id);
    }

    // =====================
    // SEEKER ENDPOINTS
    // =====================

    @Post(':id/apply')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.SEEKER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Apply for a job (swipe right)' })
    async applyToJob(
        @CurrentUser() user: JwtPayload,
        @Param('id') jobId: string,
    ) {
        const profile = await this.getSeekerProfile(user.sub);
        return this.jobService.applyToJob(jobId, profile.id);
    }

    // --- Helpers ---

    private async getClinicProfile(userId: string) {
        const profile = await this.prisma.clinicProfile.findUnique({
            where: { user_id: userId },
        });
        if (!profile) throw new Error('Clinic profile not found');
        return profile;
    }

    private async getSeekerProfile(userId: string) {
        const profile = await this.prisma.seekerProfile.findUnique({
            where: { user_id: userId },
        });
        if (!profile) throw new Error('Seeker profile not found');
        return profile;
    }
}

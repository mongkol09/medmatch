import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Req,
    NotFoundException,
    ParseFloatPipe,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserRole, PaymentMethod } from '@prisma/client';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Payment')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
        private readonly prisma: PrismaService,
    ) { }

    @Post('slip')
    @Roles(UserRole.PATIENT)
    @ApiOperation({ summary: 'Upload payment slip (JSON body)' })
    async createSlip(
        @CurrentUser() user: JwtPayload,
        @Req() req: Request,
        @Body()
        body: {
            bookingId?: string;
            clinicId: string;
            amount: number;
            paymentMethod: PaymentMethod;
            slipImageUrl?: string;
        },
    ) {
        const patient = await this.prisma.patient.findUnique({
            where: { user_id: user.sub },
        });
        if (!patient) throw new NotFoundException('Patient profile not found');

        return this.paymentService.createPayment({
            ...body,
            patientId: patient.id,
            userId: user.sub,
            ipAddress: req.ip,
        });
    }

    /**
     * POST /payments/upload-slip
     * Multipart form-data: file=<image>, bookingId=<uuid>, amount=<number>
     * Stores the slip, creates the payment record, kicks off async AI verification.
     */
    @Post('upload-slip')
    @Roles(UserRole.PATIENT)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Upload payment slip — triggers AI verification' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('slip', {
            storage: memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
            fileFilter: (_req, file, cb) => {
                if (!file.mimetype.startsWith('image/')) {
                    return cb(new BadRequestException('Only image files are accepted'), false);
                }
                cb(null, true);
            },
        }),
    )
    async uploadSlip(
        @CurrentUser() user: JwtPayload,
        @Req() req: Request,
        @UploadedFile() file: Express.Multer.File,
        @Body('bookingId') bookingId: string,
        @Body('amount') amountStr: string,
    ) {
        if (!file) throw new BadRequestException('Slip image is required');
        if (!bookingId) throw new BadRequestException('bookingId is required');
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) throw new BadRequestException('Valid amount required');

        const patient = await this.prisma.patient.findUnique({
            where: { user_id: user.sub },
        });
        if (!patient) throw new NotFoundException('Patient profile not found');

        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            select: { clinic_id: true },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        const { payment, slipImageUrl } = await this.paymentService.uploadSlipAndVerify({
            fileBuffer: file.buffer,
            originalName: file.originalname,
            bookingId,
            clinicId: booking.clinic_id,
            patientId: patient.id,
            amount,
            userId: user.sub,
            ipAddress: req.ip,
        });

        return { payment, slipImageUrl };
    }

    @Post(':id/verify')
    @Roles(UserRole.CLINIC, UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify payment slip (clinic/admin)' })
    async verifyPayment(
        @Param('id') paymentId: string,
        @Body() body: { verified: boolean; aiExtractedData?: Record<string, any> },
    ) {
        return this.paymentService.verifyPayment(
            paymentId,
            body.verified,
            'MANUAL',
            body.aiExtractedData,
        );
    }

    @Get('history')
    @Roles(UserRole.CLINIC)
    @ApiOperation({ summary: 'Get payment history (clinic)' })
    async getPaymentHistory(@CurrentUser() user: JwtPayload) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!clinic) throw new NotFoundException('Clinic profile not found');
        return this.paymentService.getClinicPaymentHistory(clinic.id);
    }

    @Get('accounting/dashboard')
    @Roles(UserRole.CLINIC)
    @ApiOperation({ summary: 'Get accounting dashboard' })
    async getAccountingDashboard(@CurrentUser() user: JwtPayload) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!clinic) throw new NotFoundException('Clinic profile not found');

        const today = new Date();
        const dailySummary = await this.paymentService.getDailySummary(
            clinic.id,
            today,
        );
        const monthlySummary = await this.paymentService.getMonthlySummary(
            clinic.id,
            today.getFullYear(),
            today.getMonth() + 1,
        );

        return { today: dailySummary, month: monthlySummary };
    }

    @Get('accounting/monthly')
    @Roles(UserRole.CLINIC)
    @ApiOperation({ summary: 'Get monthly accounting report' })
    async getMonthlyReport(
        @CurrentUser() user: JwtPayload,
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!clinic) throw new NotFoundException('Clinic profile not found');
        return this.paymentService.getMonthlySummary(
            clinic.id,
            parseInt(year),
            parseInt(month),
        );
    }
}

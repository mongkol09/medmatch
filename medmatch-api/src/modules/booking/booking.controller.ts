import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';

@ApiTags('Booking')
@Controller('booking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
    constructor(
        private readonly bookingService: BookingService,
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
    ) { }

    @Get('available-slots')
    @ApiOperation({ summary: 'Get available slots (query param style for mobile)' })
    async getAvailableSlotsQuery(
        @Query('clinicId') clinicId: string,
        @Query('date') date: string,
        @Query('providerId') providerId?: string,
    ) {
        if (!clinicId || !date) throw new NotFoundException('clinicId and date are required');
        const raw = await this.bookingService.getAvailableSlots(clinicId, date, providerId);
        // Transform to { id, time, available } for mobile client
        return (raw as any[]).map((slot, i) => ({
            id: `${clinicId}-${date}-${i}`,
            time: slot.startTime,
            endTime: slot.endTime,
            available: slot.available,
        }));
    }

    @Get('services')
    @ApiOperation({ summary: 'Get services for a clinic' })
    async getClinicServices(@Query('clinicId') clinicId: string) {
        if (!clinicId) throw new NotFoundException('clinicId required');
        return this.prisma.clinicService.findMany({
            where: { clinic_id: clinicId, is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, price: true, duration_minutes: true, description: true },
        });
    }

    @Get('slots/:clinicId')
    @ApiOperation({ summary: 'Get available slots for a clinic (path param style)' })
    async getAvailableSlots(
        @Param('clinicId') clinicId: string,
        @Query('date') date: string,
        @Query('providerId') providerId?: string,
    ) {
        return this.bookingService.getAvailableSlots(clinicId, date, providerId);
    }

    @Post()
    @Roles(UserRole.PATIENT)
    @ApiOperation({ summary: 'Create a booking (patient)' })
    async createBooking(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            clinicId?: string;
            clinic_id?: string;
            providerId?: string;
            serviceId?: string;
            bookingDate?: string;
            date?: string;
            startTime?: string;
            time_slot?: string;
            endTime?: string;
            patientNotes?: string;
            note?: string;
            totalAmount?: number;
        },
    ) {
        const patient = await this.prisma.patient.findUnique({
            where: { user_id: user.sub },
        });
        if (!patient) throw new NotFoundException('Patient profile not found');

        // Normalize mobile field names → service format
        const clinicId = body.clinicId || body.clinic_id;
        const bookingDate = body.bookingDate || body.date;
        const startTime = body.startTime || body.time_slot;
        const patientNotes = body.patientNotes || body.note;

        return this.bookingService.createBooking({
            clinicId: clinicId!,
            providerId: body.providerId,
            serviceId: body.serviceId,
            bookingDate: bookingDate!,
            startTime: startTime!,
            endTime: body.endTime || startTime!,
            patientNotes,
            totalAmount: body.totalAmount,
            patientId: patient.id,
        });
    }

    @Get('my')
    @Roles(UserRole.PATIENT)
    @ApiOperation({ summary: 'Get my bookings (patient)' })
    async getMyBookings(@CurrentUser() user: JwtPayload) {
        const patient = await this.prisma.patient.findUnique({
            where: { user_id: user.sub },
        });
        if (!patient) throw new NotFoundException('Patient profile not found');
        return this.bookingService.getPatientBookings(patient.id);
    }

    @Get('clinic/today')
    @Roles(UserRole.CLINIC)
    @ApiOperation({ summary: 'Get today\'s bookings (clinic)' })
    async getClinicBookingsToday(@CurrentUser() user: JwtPayload) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!clinic) throw new NotFoundException('Clinic profile not found');
        const bookings = await this.bookingService.getClinicBookingsToday(clinic.id);

        // Decrypt patient names before sending to mobile (BUG-012 fix)
        return bookings.map((b: any) => ({
            ...b,
            patient: b.patient ? {
                ...b.patient,
                first_name: this.tryDecrypt(b.patient.first_name_enc),
                last_name: this.tryDecrypt(b.patient.last_name_enc),
            } : b.patient,
        }));
    }

    private tryDecrypt(enc: any): string | null {
        if (!enc) return null;
        try {
            return this.encryption.decrypt(Buffer.isBuffer(enc) ? enc : Buffer.from(enc));
        } catch {
            return null;
        }
    }

    @Put(':id/confirm')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.CLINIC)
    @ApiOperation({ summary: 'Confirm a booking (clinic)' })
    async confirmBooking(
        @CurrentUser() user: JwtPayload,
        @Param('id') bookingId: string,
    ) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!clinic) throw new NotFoundException('Clinic profile not found');
        return this.bookingService.confirmBooking(bookingId, clinic.id);
    }

    @Put(':id/complete')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.CLINIC)
    @ApiOperation({ summary: 'Complete a booking (clinic)' })
    async completeBooking(
        @CurrentUser() user: JwtPayload,
        @Param('id') bookingId: string,
    ) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { user_id: user.sub },
        });
        if (!clinic) throw new NotFoundException('Clinic profile not found');
        return this.bookingService.completeBooking(bookingId, clinic.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a booking by ID' })
    async getBookingById(
        @CurrentUser() user: JwtPayload,
        @Param('id') bookingId: string,
    ) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                clinic: {
                    select: {
                        clinic_name: true,
                        address: true,
                        images: true,
                    },
                },
                service: { select: { name: true, price: true } },
                payments: {
                    orderBy: { created_at: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        amount: true,
                        status: true,
                        slip_image_url: true,
                    },
                },
            },
        });
        if (!booking) throw new NotFoundException('Booking not found');
        return {
            ...booking,
            date: booking.booking_date?.toISOString().split('T')[0],
            time_slot: booking.start_time,
            amount: booking.total_amount ?? booking.service?.price,
            payment_status: booking.payments?.[0]?.status ?? 'PENDING_PAYMENT',
            slip_image_url: booking.payments?.[0]?.slip_image_url ?? null,
        };
    }

    @Put(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel a booking' })
    async cancelBooking(
        @CurrentUser() user: JwtPayload,
        @Param('id') bookingId: string,
    ) {
        return this.bookingService.cancelBooking(bookingId, user.sub);
    }
}

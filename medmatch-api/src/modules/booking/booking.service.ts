import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { BookingStatus, PaymentBookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingService {
    private readonly logger = new Logger(BookingService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new booking
     */
    async createBooking(params: {
        clinicId: string;
        providerId?: string;
        patientId: string;
        serviceId?: string;
        bookingDate: string;
        startTime: string;
        endTime: string;
        patientNotes?: string;
        totalAmount?: number;
    }) {
        // Check slot availability
        const existingBooking = await this.prisma.booking.findFirst({
            where: {
                clinic_id: params.clinicId,
                booking_date: new Date(params.bookingDate),
                start_time: params.startTime,
                status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
                ...(params.providerId && { provider_id: params.providerId }),
            },
        });

        if (existingBooking) {
            throw new BadRequestException('This time slot is already booked');
        }

        return this.prisma.booking.create({
            data: {
                clinic_id: params.clinicId,
                provider_id: params.providerId,
                patient_id: params.patientId,
                service_id: params.serviceId,
                booking_date: new Date(params.bookingDate),
                start_time: params.startTime,
                end_time: params.endTime,
                patient_notes: params.patientNotes,
                total_amount: params.totalAmount,
            },
            include: {
                clinic: { select: { clinic_name: true, address: true } },
                service: { select: { name: true, price: true } },
            },
        });
    }

    /**
     * Get available slots for a clinic on a specific date
     */
    async getAvailableSlots(clinicId: string, date: string, providerId?: string) {
        // Get clinic schedules
        const dayOfWeek = new Date(date).getDay();
        const schedules = await this.prisma.clinicSchedule.findMany({
            where: {
                clinic_id: clinicId,
                day_of_week: dayOfWeek,
                is_active: true,
                ...(providerId && { provider_id: providerId }),
            },
        });

        // When no custom schedule configured, fall back to default 09:00–18:00 with 30-min slots
        const effectiveSchedules = schedules.length > 0 ? schedules : [{
            start_time: '09:00',
            end_time: '18:00',
            slot_duration_minutes: 30,
            buffer_minutes: 0,
        }];

        // Get existing bookings for that date
        const existingBookings = await this.prisma.booking.findMany({
            where: {
                clinic_id: clinicId,
                booking_date: new Date(date),
                status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
                ...(providerId && { provider_id: providerId }),
            },
            select: { start_time: true, end_time: true },
        });

        const bookedSlots = new Set(existingBookings.map((b) => b.start_time));

        // Generate all slots and mark availability
        const slots: Array<{
            startTime: string;
            endTime: string;
            available: boolean;
        }> = [];

        for (const schedule of effectiveSchedules) {
            const slotDuration = schedule.slot_duration_minutes;
            const buffer = schedule.buffer_minutes;
            let currentTime = this.timeToMinutes(schedule.start_time);
            const scheduleEnd = this.timeToMinutes(schedule.end_time);

            while (currentTime + slotDuration <= scheduleEnd) {
                const startStr = this.minutesToTime(currentTime);
                const endStr = this.minutesToTime(currentTime + slotDuration);

                slots.push({
                    startTime: startStr,
                    endTime: endStr,
                    available: !bookedSlots.has(startStr),
                });

                currentTime += slotDuration + buffer;
            }
        }

        return slots;
    }

    /**
     * Confirm a booking (clinic/provider)
     */
    async confirmBooking(bookingId: string, clinicId: string) {
        const booking = await this.prisma.booking.findFirst({
            where: { id: bookingId, clinic_id: clinicId },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.CONFIRMED },
        });
    }

    /**
     * Complete a booking (after treatment)
     */
    async completeBooking(bookingId: string, clinicId: string) {
        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.COMPLETED },
        });
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(bookingId: string, userId: string) {
        const booking = await this.prisma.booking.findFirst({
            where: {
                id: bookingId,
                OR: [
                    { patient: { user_id: userId } },
                    { clinic: { user_id: userId } },
                ],
            },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.CANCELLED },
        });
    }

    /**
     * Get patient's bookings
     */
    async getPatientBookings(patientId: string) {
        return this.prisma.booking.findMany({
            where: { patient_id: patientId },
            include: {
                clinic: { select: { clinic_name: true, address: true, latitude: true, longitude: true } },
                service: { select: { name: true, price: true } },
            },
            orderBy: { booking_date: 'desc' },
        });
    }

    /**
     * Get clinic's bookings for today
     */
    async getClinicBookingsToday(clinicId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.prisma.booking.findMany({
            where: {
                clinic_id: clinicId,
                booking_date: { gte: today, lt: tomorrow },
            },
            include: {
                patient: { select: { first_name_enc: true, last_name_enc: true, profile_image_url: true } },
                service: { select: { name: true } },
            },
            orderBy: { start_time: 'asc' },
        });
    }

    // --- Helpers ---

    private timeToMinutes(time: string): number {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }

    private minutesToTime(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
}

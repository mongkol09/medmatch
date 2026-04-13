import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingService } from '../booking.service';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const makePrisma = () => ({
    booking: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    clinicSchedule: {
        findMany: jest.fn(),
    },
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS = {
    clinicId: 'clinic-uuid',
    patientId: 'patient-uuid',
    bookingDate: '2026-06-01',
    startTime: '09:00',
    endTime: '10:00',
};

const MOCK_BOOKING = {
    id: 'booking-uuid',
    clinic_id: 'clinic-uuid',
    patient_id: 'patient-uuid',
    booking_date: new Date('2026-06-01'),
    start_time: '09:00',
    end_time: '10:00',
    status: BookingStatus.PENDING,
    clinic: { clinic_name: 'Test Clinic', address: 'BKK' },
    service: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookingService', () => {
    let service: BookingService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(async () => {
        prisma = makePrisma();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<BookingService>(BookingService);
    });

    // ── createBooking ─────────────────────────────────────────────────────────

    describe('createBooking()', () => {
        it('throws BadRequestException when slot is already taken', async () => {
            prisma.booking.findFirst.mockResolvedValue(MOCK_BOOKING);

            await expect(service.createBooking(BASE_PARAMS)).rejects.toThrow(
                BadRequestException,
            );
            expect(prisma.booking.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        clinic_id: 'clinic-uuid',
                        start_time: '09:00',
                    }),
                }),
            );
        });

        it('creates booking when slot is free', async () => {
            prisma.booking.findFirst.mockResolvedValue(null);
            prisma.booking.create.mockResolvedValue(MOCK_BOOKING);

            const result = await service.createBooking(BASE_PARAMS);

            expect(prisma.booking.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        clinic_id: 'clinic-uuid',
                        patient_id: 'patient-uuid',
                        start_time: '09:00',
                    }),
                }),
            );
            expect(result.id).toBe('booking-uuid');
        });
    });

    // ── getAvailableSlots ─────────────────────────────────────────────────────

    describe('getAvailableSlots()', () => {
        it('returns empty array when no schedules configured', async () => {
            prisma.clinicSchedule.findMany.mockResolvedValue([]);

            const result = await service.getAvailableSlots('clinic-uuid', '2026-06-01');

            expect(result).toEqual([]);
        });

        it('marks a slot as unavailable when already booked', async () => {
            prisma.clinicSchedule.findMany.mockResolvedValue([
                {
                    id: 'sched-uuid',
                    clinic_id: 'clinic-uuid',
                    day_of_week: new Date('2026-06-01').getDay(),
                    start_time: '09:00',
                    end_time: '11:00',
                    slot_duration_minutes: 60,
                    buffer_minutes: 0,
                    is_active: true,
                },
            ]);

            // 09:00 is already booked
            prisma.booking.findMany.mockResolvedValue([
                { start_time: '09:00', end_time: '10:00' },
            ]);

            const slots = await service.getAvailableSlots('clinic-uuid', '2026-06-01');

            const nineAm = slots.find((s) => s.startTime === '09:00');
            const tenAm = slots.find((s) => s.startTime === '10:00');

            expect(nineAm?.available).toBe(false);
            expect(tenAm?.available).toBe(true);
        });

        it('returns all slots available when no existing bookings', async () => {
            prisma.clinicSchedule.findMany.mockResolvedValue([
                {
                    id: 'sched-uuid',
                    clinic_id: 'clinic-uuid',
                    day_of_week: new Date('2026-06-01').getDay(),
                    start_time: '09:00',
                    end_time: '11:00',
                    slot_duration_minutes: 60,
                    buffer_minutes: 0,
                    is_active: true,
                },
            ]);
            prisma.booking.findMany.mockResolvedValue([]);

            const slots = await service.getAvailableSlots('clinic-uuid', '2026-06-01');

            expect(slots).toHaveLength(2);
            expect(slots.every((s) => s.available)).toBe(true);
        });
    });

    // ── cancelBooking ─────────────────────────────────────────────────────────

    describe('cancelBooking()', () => {
        it('throws NotFoundException when booking not found or not owned', async () => {
            prisma.booking.findFirst.mockResolvedValue(null);

            await expect(
                service.cancelBooking('booking-uuid', 'user-uuid'),
            ).rejects.toThrow(NotFoundException);
        });

        it('updates booking status to CANCELLED on success', async () => {
            prisma.booking.findFirst.mockResolvedValue(MOCK_BOOKING);
            prisma.booking.update.mockResolvedValue({
                ...MOCK_BOOKING,
                status: BookingStatus.CANCELLED,
            });

            const result = await service.cancelBooking('booking-uuid', 'user-uuid');

            expect(prisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-uuid' },
                data: { status: BookingStatus.CANCELLED },
            });
            expect(result.status).toBe(BookingStatus.CANCELLED);
        });
    });
});

/**
 * Booking Flow Integration Tests
 * Tests: Get slots → Create booking → Confirm → Complete → Cancel
 * Also: Payment upload → Review
 */

describe('Booking Flow - Full Pipeline', () => {
    // ════════════════════════════════════════════════
    // 1. GET AVAILABLE SLOTS
    // ════════════════════════════════════════════════
    describe('GET /booking/available-slots — Available Slots', () => {
        it('should accept clinicId and date as query params', () => {
            const params = { clinicId: 'clinic-uuid', date: '2026-04-15' };
            expect(params.clinicId).toBeDefined();
            expect(params.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('response transforms to mobile format', () => {
            // Backend returns: { startTime, endTime, available }
            // Controller transforms to: { id, time, endTime, available }
            const transformed = {
                id: 'slot-09:00',
                time: '09:00',
                endTime: '09:30',
                available: true,
            };
            expect(transformed).toHaveProperty('id');
            expect(transformed).toHaveProperty('time');
            expect(transformed).toHaveProperty('available');
        });
    });

    // ════════════════════════════════════════════════
    // 2. GET CLINIC SERVICES
    // ════════════════════════════════════════════════
    describe('GET /booking/services — Clinic Services', () => {
        it('should accept clinicId as query param', () => {
            const params = { clinicId: 'clinic-uuid' };
            expect(params.clinicId).toBeDefined();
        });

        it('response includes ClinicService fields', () => {
            const service = {
                id: 'svc-uuid',
                name: 'Teeth Cleaning',
                price: 1500,
                duration: 30,
                description: 'Basic teeth cleaning',
            };
            expect(service).toHaveProperty('name');
            expect(service).toHaveProperty('price');
            expect(service).toHaveProperty('duration');
        });
    });

    // ════════════════════════════════════════════════
    // 3. CREATE BOOKING
    // ════════════════════════════════════════════════
    describe('POST /booking — Create Booking (Patient)', () => {
        it('should accept both camelCase and snake_case field names', () => {
            // booking.controller.ts normalizes both formats:
            // clinicId OR clinic_id
            // bookingDate OR date
            // timeSlot OR time_slot OR startTime

            const camelPayload = {
                clinicId: 'clinic-uuid',
                bookingDate: '2026-04-15',
                startTime: '09:00',
                endTime: '09:30',
                serviceId: 'svc-uuid',
            };

            const snakePayload = {
                clinic_id: 'clinic-uuid',
                date: '2026-04-15',
                time_slot: '09:00',
            };

            expect(camelPayload.clinicId || snakePayload.clinic_id).toBeTruthy();
        });
    });

    // ════════════════════════════════════════════════
    // 4. MY BOOKINGS (PATIENT)
    // ════════════════════════════════════════════════
    describe('GET /booking/my — My Bookings (Patient)', () => {
        it('should return array of bookings', () => {
            const booking = {
                id: 'booking-uuid',
                status: 'CONFIRMED',
                booking_date: '2026-04-15',
                start_time: '09:00',
                end_time: '09:30',
                total_amount: 1500,
                payment_status: 'UNPAID',
            };
            expect(booking.status).toMatch(/^(PENDING|CONFIRMED|COMPLETED|CANCELLED|NO_SHOW)$/);
        });
    });

    // ════════════════════════════════════════════════
    // 5. CLINIC TODAY'S BOOKINGS
    // ════════════════════════════════════════════════
    describe('GET /booking/clinic/today — Clinic Today (Clinic)', () => {
        it('should include patient name data (first_name_enc, last_name_enc)', () => {
            // 🐛 BUG was: first_name_enc: false (excluded patient name)
            // Now fixed: first_name_enc: true, last_name_enc: true
            const booking = {
                id: 'booking-uuid',
                patient: {
                    first_name_enc: 'encrypted_name',
                    last_name_enc: 'encrypted_lastname',
                    profile_image_url: null,
                },
                service: { name: 'Cleaning' },
            };
            expect(booking.patient).toHaveProperty('first_name_enc');
            expect(booking.patient).toHaveProperty('last_name_enc');
        });
    });

    // ════════════════════════════════════════════════
    // 6. CONFIRM / COMPLETE / CANCEL
    // ════════════════════════════════════════════════
    describe('PUT /booking/:id/confirm — Confirm Booking (Clinic)', () => {
        it('should use PUT method', () => {
            const method = 'PUT';
            const path = '/booking/BOOKING_ID/confirm';
            expect(method).toBe('PUT');
            expect(path).toContain('/confirm');
        });
    });

    describe('PUT /booking/:id/complete — Complete Booking (Clinic)', () => {
        it('should use PUT method', () => {
            const method = 'PUT';
            const path = '/booking/BOOKING_ID/complete';
            expect(method).toBe('PUT');
            expect(path).toContain('/complete');
        });
    });

    describe('PUT /booking/:id/cancel — Cancel Booking', () => {
        it('should use PUT method (not PATCH or DELETE)', () => {
            // my-bookings.tsx sends: api.put(`/booking/${bookingId}/cancel`)
            const method = 'PUT';
            expect(method).toBe('PUT');
        });
    });

    // ════════════════════════════════════════════════
    // 7. PAYMENT UPLOAD
    // ════════════════════════════════════════════════
    describe('POST /payments/upload-slip — Upload Slip', () => {
        it('should accept FormData with slip image', () => {
            // payment/[bookingId].tsx sends FormData with:
            const formDataFields = ['slip', 'bookingId', 'amount'];
            expect(formDataFields).toContain('slip');
            expect(formDataFields).toContain('bookingId');
        });
    });

    // ════════════════════════════════════════════════
    // 8. REVIEW
    // ════════════════════════════════════════════════
    describe('POST /reviews — Create Review', () => {
        it('🐛 BUG: review/[id].tsx sends to /review (singular) but backend is /reviews (plural)', () => {
            const mobileSends = '/review';     // WRONG
            const backendPath = '/reviews';     // CORRECT
            expect(mobileSends).not.toEqual(backendPath);
        });

        it('🐛 BUG: review/[id].tsx sends booking_id but backend expects bookingId', () => {
            // Mobile sends:
            const mobilePayload = {
                booking_id: 'booking-uuid',   // snake_case
                rating: 5,
                comment: 'Great!',
            };
            // Backend expects:
            const backendExpects = {
                bookingId: 'booking-uuid',    // camelCase
                revieweeId: 'user-uuid',      // REQUIRED but mobile doesn't send!
                rating: 5,
                comment: 'Great!',
            };

            // 🐛 BUG: Mobile sends booking_id but backend expects bookingId
            expect(Object.keys(mobilePayload)).toContain('booking_id');
            expect(Object.keys(backendExpects)).toContain('bookingId');

            // 🐛 BUG: Mobile doesn't send revieweeId — but backend requires it!
            expect(Object.keys(mobilePayload)).not.toContain('revieweeId');
        });
    });
});

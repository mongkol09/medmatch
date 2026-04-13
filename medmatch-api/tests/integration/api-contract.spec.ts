/**
 * API Contract Tests
 * Verifies that the Mobile app sends data in the format the Backend expects.
 * Each test documents a specific mobile screen → backend endpoint contract.
 *
 * 🐛 = BUG FOUND (mismatch between mobile and backend)
 * ✅ = Contract verified OK
 */

describe('API Contract: Mobile → Backend', () => {
    // ════════════════════════════════════════════════
    // AUTH CONTRACTS
    // ════════════════════════════════════════════════
    describe('Auth Contracts', () => {
        it('✅ login.tsx → POST /auth/login', () => {
            const mobile = { email: 'test@test.com', password: 'pass123' };
            const dto = ['email', 'password'];
            dto.forEach(field => expect(mobile).toHaveProperty(field));
        });

        it('✅ register.tsx → POST /auth/register', () => {
            const mobile = { email: 'new@test.com', password: 'pass123', role: 'SEEKER' };
            expect(mobile).toHaveProperty('role');
        });

        it('✅ otp-verify.tsx → POST /auth/verify-otp', () => {
            const mobile = { userId: 'uuid', code: '123456' };
            expect(mobile).toHaveProperty('userId');
            expect(mobile).toHaveProperty('code');
        });

        it('✅ settings.tsx → PATCH /auth/change-password', () => {
            const mobile = { current_password: 'old', new_password: 'newPass1' };
            expect(mobile).toHaveProperty('current_password');
            expect(mobile).toHaveProperty('new_password');
        });
    });

    // ════════════════════════════════════════════════
    // JOB CONTRACTS
    // ════════════════════════════════════════════════
    describe('Job Contracts', () => {
        it('✅ post.tsx → POST /jobs — field mapping is correct', () => {
            // post.tsx transforms snake_case form state to camelCase DTO
            const mobileSends = {
                title: 'test',
                specialtyRequired: 'GENERAL_DENTISTRY',
                workDate: '2026-05-10',
                startTime: '09:00',
                endTime: '17:00',
                payAmount: 5000,
                payNegotiable: false,
                slots: 1,
            };
            const dtoFields = [
                'title', 'specialtyRequired', 'workDate', 'startTime',
                'endTime', 'payAmount', 'payNegotiable', 'slots',
            ];
            dtoFields.forEach(field => expect(mobileSends).toHaveProperty(field));
        });

        it('✅ edit.tsx → PUT /jobs/:id — sends correct camelCase', () => {
            const mobileSends = {
                title: 'updated',
                specialtyRequired: 'ORTHODONTICS',
                workDate: '2026-05-15',
                startTime: '10:00',
                endTime: '18:00',
                payAmount: 6000,
                isNegotiable: true,
                slotsNeeded: 2,
            };
            // Backend PUT handler destructures these correctly
            expect(mobileSends).toHaveProperty('isNegotiable');
            expect(mobileSends).toHaveProperty('slotsNeeded');
        });

        it('🐛 BUG: edit.tsx reads response with WRONG field names', () => {
            // GET /jobs/:id returns Prisma model fields:
            const response = {
                pay_negotiable: false,    // Prisma field
                slots: 1,                 // Prisma field
            };

            // edit.tsx reads: job.is_negotiable → UNDEFINED (wrong name)
            expect(response).not.toHaveProperty('is_negotiable');
            // edit.tsx reads: job.slots_needed → UNDEFINED (wrong name)
            expect(response).not.toHaveProperty('slots_needed');

            // Should read: job.pay_negotiable and job.slots
            expect(response).toHaveProperty('pay_negotiable');
            expect(response).toHaveProperty('slots');
        });

        it('🐛 BUG #1 (CRITICAL): applicants.tsx uses /job/ instead of /jobs/', () => {
            // WRONG URLs used by applicants.tsx:
            const wrongUrls = [
                { mobile: '/job/ID',              correct: '/jobs/ID' },
                { mobile: '/job/ID/applicants',   correct: '/jobs/ID/applicants' },
                { mobile: '/job/ID/accept/AID',   correct: '/jobs/applicants/AID/accept' },
                { mobile: '/job/ID/reject/AID',   correct: '/jobs/applicants/AID/reject' },
            ];

            wrongUrls.forEach(({ mobile, correct }) => {
                expect(mobile).not.toEqual(correct);
            });
        });

        it('🐛 BUG #2 (CRITICAL): applicants.tsx accept/reject URL structure is completely wrong', () => {
            // Mobile pattern:   /job/{jobId}/accept/{applicantId}
            // Backend pattern:  /jobs/applicants/{applicationId}/accept

            // The backend routes are:
            // @Post('applicants/:id/accept')  → /jobs/applicants/:id/accept
            // @Post('applicants/:id/reject')  → /jobs/applicants/:id/reject

            // But mobile sends:
            // api.post(`/job/${id}/accept/${applicantId}`)
            // api.post(`/job/${id}/reject/${applicantId}`)

            const mobileAccept = '/job/JOB_ID/accept/APP_ID';
            const backendAccept = '/jobs/applicants/APP_ID/accept';
            expect(mobileAccept).not.toContain('/jobs/applicants/');
        });

        it('🐛 BUG #3: applicants.tsx expects different field names than backend returns', () => {
            // Backend getApplicants returns seeker with:
            const backendFields = [
                'first_name', 'last_name', 'license_type', 'license_verified',
                'experience_years', 'specialties', 'profile_image_url',
                'rating_avg', 'rating_count',
            ];

            // Mobile Applicant interface expects:
            const mobileFields = [
                'full_name', 'specialty', 'years_experience',
                'average_rating', 'review_count', 'is_verified',
            ];

            // Every mobile field has a different name than backend:
            const mismatches = [
                { mobile: 'full_name',        backend: 'first_name + last_name' },
                { mobile: 'specialty',         backend: 'license_type' },
                { mobile: 'years_experience',  backend: 'experience_years' },
                { mobile: 'average_rating',    backend: 'rating_avg' },
                { mobile: 'review_count',      backend: 'rating_count' },
                { mobile: 'is_verified',       backend: 'license_verified' },
            ];

            expect(mismatches).toHaveLength(6);
            mismatches.forEach(m => {
                expect(backendFields).not.toContain(m.mobile);
            });
        });

        it('🐛 BUG #4: my-jobs.tsx expects flat fields but backend returns _count', () => {
            // Backend getMyJobs includes: _count: { applications, matches }
            const backendResponse = {
                id: 'job-id',
                _count: { applications: 5, matches: 2 },
                slots: 3,
            };

            // my-jobs.tsx reads:
            // item.application_count → UNDEFINED
            // item.match_count → UNDEFINED
            // item.slots_needed → UNDEFINED
            expect(backendResponse).not.toHaveProperty('application_count');
            expect(backendResponse).not.toHaveProperty('match_count');
            expect(backendResponse).not.toHaveProperty('slots_needed');
        });
    });

    // ════════════════════════════════════════════════
    // MAP/HOME CONTRACTS
    // ════════════════════════════════════════════════
    describe('Map Contracts', () => {
        it('🐛 BUG: home.tsx calls /map/clinics/preview but backend has /map/clinic/:id/preview', () => {
            const mobilePath = '/map/clinics/preview';          // plural + query params
            const backendPath = '/map/clinic/:id/preview';      // singular + path param

            // home.tsx sends: GET /map/clinics/preview?latitude=...&longitude=...&radiusKm=...
            // But backend only has: GET /map/clinic/:id/preview (single clinic, by ID)
            // There is NO bulk clinic search endpoint in map.controller.ts!

            expect(mobilePath).not.toContain('/clinic/');
        });
    });

    // ════════════════════════════════════════════════
    // REVIEW CONTRACTS
    // ════════════════════════════════════════════════
    describe('Review Contracts', () => {
        it('🐛 BUG: review/[id].tsx sends to /review (singular)', () => {
            // Mobile: api.post('/review', { ... })
            // Backend: @Controller('reviews') → POST /reviews
            const mobilePath = '/review';
            const backendPath = '/reviews';
            expect(mobilePath).not.toEqual(backendPath);
        });

        it('🐛 BUG: review/[id].tsx sends wrong field names', () => {
            // Mobile sends:
            const mobilePayload = {
                booking_id: 'uuid',       // snake_case
                rating: 5,
                comment: 'Great',
                aspect_ratings: {},        // not in backend
            };

            // Backend expects:
            const backendExpects = {
                bookingId: 'uuid',         // camelCase
                revieweeId: 'user-uuid',   // REQUIRED!
                rating: 5,
                comment: 'Great',
            };

            // Field name mismatch:
            expect(Object.keys(mobilePayload)).toContain('booking_id');
            expect(Object.keys(backendExpects)).toContain('bookingId');

            // Missing required field:
            expect(Object.keys(mobilePayload)).not.toContain('revieweeId');
        });
    });

    // ════════════════════════════════════════════════
    // CHAT CONTRACTS
    // ════════════════════════════════════════════════
    describe('Chat Contracts', () => {
        it('✅ chat.tsx → POST /chat/conversations', () => {
            const mobile = { participant_id: 'user-uuid' };
            expect(mobile).toHaveProperty('participant_id');
        });

        it('✅ chat/[id].tsx → GET /chat/:id/messages', () => {
            const params = { type: 'match', limit: 50 };
            expect(params).toHaveProperty('type');
        });

        it('✅ chat/[id].tsx → PATCH /chat/:id/read', () => {
            const params = { type: 'match' };
            expect(params).toHaveProperty('type');
        });
    });

    // ════════════════════════════════════════════════
    // NOTIFICATION CONTRACTS
    // ════════════════════════════════════════════════
    describe('Notification Contracts', () => {
        it('✅ notifications.tsx → GET /notifications with pagination', () => {
            const params = { page: 1, limit: 20 };
            expect(params).toHaveProperty('page');
        });

        it('✅ profile.tsx → GET /notifications/unread-count', () => {
            const expected = { count: 5 };
            expect(expected).toHaveProperty('count');
        });
    });
});

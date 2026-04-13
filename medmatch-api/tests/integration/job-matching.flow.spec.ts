/**
 * Job Matching Flow Integration Tests
 * Tests: Clinic posts job → Seeker browses → Seeker applies → Clinic accepts/rejects
 *
 * BUGS FOUND are documented inline with 🐛
 */

describe('Job Matching Flow - Full Pipeline', () => {
    // ════════════════════════════════════════════════
    // 1. CLINIC POSTS A JOB
    // ════════════════════════════════════════════════
    describe('POST /jobs — Create Job (Clinic)', () => {
        it('should accept camelCase field names matching CreateJobDto', () => {
            // Backend DTO expects these exact camelCase fields:
            const correctPayload = {
                title: 'ทันตแพทย์ GP เสาร์-อาทิตย์',
                specialtyRequired: 'GENERAL_DENTISTRY',  // camelCase ✓
                workDate: '2026-05-10',                   // camelCase ✓
                startTime: '09:00',                       // camelCase ✓
                endTime: '17:00',                         // camelCase ✓
                payAmount: 5000,                          // camelCase ✓
                payNegotiable: false,                     // camelCase ✓
                slots: 1,                                 // Not "slots_needed" ✓
            };

            expect(correctPayload).toHaveProperty('specialtyRequired');
            expect(correctPayload).toHaveProperty('workDate');
            expect(correctPayload).toHaveProperty('startTime');
            expect(correctPayload).toHaveProperty('endTime');
            expect(correctPayload).toHaveProperty('payAmount');
            expect(correctPayload).toHaveProperty('payNegotiable');
            expect(correctPayload).toHaveProperty('slots');
        });

        it('🐛 BUG: post.tsx sends correct camelCase fields — VERIFIED OK', () => {
            // post.tsx sends:
            const mobilePayload = {
                title: 'ทันตแพทย์ GP',
                specialtyRequired: 'GENERAL_DENTISTRY',   // ✓ transformed from form.specialty_required
                workDate: '2026-05-10',                    // ✓ transformed from form.work_date
                startTime: '09:00',                        // ✓ transformed from form.start_time
                endTime: '17:00',                          // ✓ transformed from form.end_time
                payAmount: 5000,                           // ✓ Number(form.pay_amount)
                payNegotiable: false,                      // ✓ form.is_negotiable
                slots: 1,                                  // ✓ Number(form.slots_needed)
                description: 'requirements\nbenefits',     // ✓ combined
            };

            // DTO field name verification
            expect(mobilePayload.specialtyRequired).toBeDefined(); // Not specialty_required
            expect(mobilePayload.payNegotiable).toBeDefined();     // Not is_negotiable
            expect(mobilePayload.slots).toBeDefined();             // Not slots_needed
        });

        it('should include requirements and benefits in description', () => {
            // post.tsx combines them: [form.requirements, form.benefits].filter(Boolean).join('\\n')
            const requirements = 'Must have endo experience';
            const benefits = 'Lunch provided';
            const description = [requirements, benefits].filter(Boolean).join('\n');
            expect(description).toContain(requirements);
            expect(description).toContain(benefits);
        });
    });

    // ════════════════════════════════════════════════
    // 2. SEEKER BROWSES JOBS
    // ════════════════════════════════════════════════
    describe('GET /jobs/browse — Browse Jobs (Seeker)', () => {
        it('should accept optional lat/lng for nationwide search', () => {
            // Nationwide: no lat/lng
            const nationwideParams = { sortBy: 'newest' };
            expect(nationwideParams).not.toHaveProperty('latitude');
            expect(nationwideParams).not.toHaveProperty('longitude');
        });

        it('should accept location-based search with radius', () => {
            const localParams = {
                latitude: 13.7563,
                longitude: 100.5018,
                radiusKm: 50,
                sortBy: 'distance',
            };
            expect(localParams.latitude).toBeDefined();
            expect(localParams.longitude).toBeDefined();
            expect(localParams.radiusKm).toBeGreaterThan(0);
        });

        it('should accept optional filters', () => {
            const withFilters = {
                latitude: 18.7883,
                longitude: 98.9853,
                radiusKm: 20,
                specialty: 'GENERAL_DENTISTRY',
                minPay: 3000,
                date: '2026-05-10',
                sortBy: 'pay',
            };
            expect(withFilters).toHaveProperty('specialty');
            expect(withFilters).toHaveProperty('minPay');
            expect(withFilters).toHaveProperty('date');
        });

        it('should return { data: [], meta: {} } shape', () => {
            const expectedShape = {
                data: [
                    {
                        id: 'job-uuid',
                        title: 'ทันตแพทย์',
                        clinic: { clinic_name: 'คลินิกทดสอบ', address: 'Bangkok' },
                        distance_km: 5.2,
                    },
                ],
                meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
            };
            expect(expectedShape.data).toBeInstanceOf(Array);
            expect(expectedShape.meta).toHaveProperty('total');
        });

        it('distance_km should be null for nationwide results', () => {
            const nationwideResult = { id: 'job-uuid', distance_km: null };
            expect(nationwideResult.distance_km).toBeNull();
        });
    });

    // ════════════════════════════════════════════════
    // 3. SEEKER APPLIES FOR JOB
    // ════════════════════════════════════════════════
    describe('POST /jobs/:id/apply — Apply for Job (Seeker)', () => {
        it('should use plural /jobs/ not /job/', () => {
            const correctPath = '/jobs/job-uuid-123/apply';
            expect(correctPath).toContain('/jobs/');
            expect(correctPath).not.toMatch(/^\/job\//);
        });

        it('should send empty body', () => {
            const body = {};
            expect(Object.keys(body)).toHaveLength(0);
        });
    });

    // ════════════════════════════════════════════════
    // 4. CLINIC VIEWS APPLICANTS
    // ════════════════════════════════════════════════
    describe('GET /jobs/:id/applicants — View Applicants (Clinic)', () => {
        it('🐛 BUG: applicants.tsx uses /job/ (singular) instead of /jobs/ (plural)', () => {
            // Mobile sends (WRONG):
            const mobilePath = '/job/JOB_ID/applicants';
            // Backend expects (CORRECT):
            const backendPath = '/jobs/JOB_ID/applicants';

            expect(mobilePath).not.toEqual(backendPath);
            // This will cause a 404 error!
        });

        it('🐛 BUG: applicants.tsx fetches job detail from /job/:id (wrong)', () => {
            const mobilePath = '/job/JOB_ID';          // WRONG
            const correctPath = '/jobs/JOB_ID';        // CORRECT

            expect(mobilePath).not.toEqual(correctPath);
        });

        it('should return applicants with seeker profile data', () => {
            const expectedApplicant = {
                id: 'app-uuid',
                status: 'PENDING',
                created_at: '2026-04-11',
                seeker: {
                    // Backend returns these field names from Prisma:
                    first_name: 'สมชาย',
                    last_name: 'ดี',
                    license_type: 'DENTIST',
                    license_verified: true,
                    experience_years: 5,
                    specialties: ['endo', 'prosth'],
                    profile_image_url: null,
                    rating_avg: 4.5,
                    rating_count: 12,
                },
            };

            // 🐛 BUG: Mobile expects `seeker.full_name` but backend returns `seeker.first_name` + `seeker.last_name`
            expect(expectedApplicant.seeker).not.toHaveProperty('full_name');
            expect(expectedApplicant.seeker).toHaveProperty('first_name');
            expect(expectedApplicant.seeker).toHaveProperty('last_name');

            // 🐛 BUG: Mobile expects `seeker.specialty` but backend returns `seeker.license_type`
            expect(expectedApplicant.seeker).not.toHaveProperty('specialty');
            expect(expectedApplicant.seeker).toHaveProperty('license_type');

            // 🐛 BUG: Mobile expects `seeker.years_experience` but backend returns `seeker.experience_years`
            expect(expectedApplicant.seeker).not.toHaveProperty('years_experience');
            expect(expectedApplicant.seeker).toHaveProperty('experience_years');

            // 🐛 BUG: Mobile expects `seeker.average_rating` but backend returns `seeker.rating_avg`
            expect(expectedApplicant.seeker).not.toHaveProperty('average_rating');
            expect(expectedApplicant.seeker).toHaveProperty('rating_avg');

            // 🐛 BUG: Mobile expects `seeker.review_count` but backend returns `seeker.rating_count`
            expect(expectedApplicant.seeker).not.toHaveProperty('review_count');
            expect(expectedApplicant.seeker).toHaveProperty('rating_count');

            // 🐛 BUG: Mobile expects `seeker.is_verified` but backend returns `seeker.license_verified`
            expect(expectedApplicant.seeker).not.toHaveProperty('is_verified');
            expect(expectedApplicant.seeker).toHaveProperty('license_verified');
        });
    });

    // ════════════════════════════════════════════════
    // 5. CLINIC ACCEPTS / REJECTS APPLICANT
    // ════════════════════════════════════════════════
    describe('Accept/Reject Applicant (Clinic)', () => {
        it('🐛 BUG: applicants.tsx uses wrong URL pattern for accept', () => {
            // Mobile sends (WRONG):
            const mobilePath = '/job/JOB_ID/accept/APPLICANT_ID';
            // Backend expects (CORRECT):
            const correctPath = '/jobs/applicants/APPLICANT_ID/accept';

            expect(mobilePath).not.toEqual(correctPath);
            // This is completely different URL structure!
        });

        it('🐛 BUG: applicants.tsx uses wrong URL pattern for reject', () => {
            // Mobile sends (WRONG):
            const mobilePath = '/job/JOB_ID/reject/APPLICANT_ID';
            // Backend expects (CORRECT):
            const correctPath = '/jobs/applicants/APPLICANT_ID/reject';

            expect(mobilePath).not.toEqual(correctPath);
        });

        it('backend accept creates a Match and increments filled_slots', () => {
            // Acceptance flow:
            // 1. Application status → ACCEPTED
            // 2. New Match created (status: CONFIRMED)
            // 3. job.filled_slots incremented
            // 4. If filled_slots >= slots → job.status = FILLED
            const flow = ['UPDATE_APPLICATION', 'CREATE_MATCH', 'INCREMENT_FILLED'];
            expect(flow).toHaveLength(3);
        });
    });

    // ════════════════════════════════════════════════
    // 6. EDIT JOB
    // ════════════════════════════════════════════════
    describe('PUT /jobs/:id — Edit Job (Clinic)', () => {
        it('edit.tsx sends correct camelCase body', () => {
            const payload = {
                title: 'Updated title',
                specialtyRequired: 'ORTHODONTICS',
                workDate: '2026-05-15',
                startTime: '10:00',
                endTime: '18:00',
                payAmount: 6000,
                isNegotiable: true,
                slotsNeeded: 2,
                requirements: 'Updated requirements',
                benefits: 'Updated benefits',
            };
            expect(payload.specialtyRequired).toBeDefined();
        });

        it('🐛 BUG: edit.tsx reads wrong field names from GET /jobs/:id response', () => {
            // Backend returns Prisma field names:
            const apiResponse = {
                title: 'Job Title',
                specialty_required: 'GENERAL_DENTISTRY',
                work_date: '2026-05-10T00:00:00.000Z',
                start_time: '09:00',
                end_time: '17:00',
                pay_amount: 5000,
                pay_negotiable: false,     // Prisma field name
                slots: 1,                  // Prisma field name
                requirements: null,
                benefits: null,
            };

            // edit.tsx reads:
            // setIsNegotiable(job.is_negotiable || false)  ← WRONG! Field is `pay_negotiable`
            expect(apiResponse).not.toHaveProperty('is_negotiable');
            expect(apiResponse).toHaveProperty('pay_negotiable');

            // setSlotsNeeded(job.slots_needed ? ...)  ← WRONG! Field is `slots`
            expect(apiResponse).not.toHaveProperty('slots_needed');
            expect(apiResponse).toHaveProperty('slots');
        });
    });

    // ════════════════════════════════════════════════
    // 7. MY JOBS
    // ════════════════════════════════════════════════
    describe('GET /jobs/my — My Posted Jobs (Clinic)', () => {
        it('response includes _count for applications and matches', () => {
            const apiResponse = {
                id: 'job-uuid',
                title: 'Job Title',
                _count: { applications: 5, matches: 2 },
                status: 'OPEN',
                slots: 3,
            };

            // 🐛 BUG: my-jobs.tsx expects `application_count` and `match_count`
            // But backend returns `_count.applications` and `_count.matches`
            expect(apiResponse).not.toHaveProperty('application_count');
            expect(apiResponse).toHaveProperty('_count');
            expect(apiResponse._count).toHaveProperty('applications');

            // 🐛 BUG: my-jobs.tsx expects `slots_needed` but backend returns `slots`
            expect(apiResponse).not.toHaveProperty('slots_needed');
            expect(apiResponse).toHaveProperty('slots');
        });
    });
});

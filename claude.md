# MedMatch Development Tracker

Last updated: 12 เมษายน 2569 (Navbar + Badges + Calendar Modal + Full Job Flow)

## Remaining Functions (Based on current code)

### Backend (medmatch-api)

- [x] Replace image upload stubs with real object storage integration (5 เม.ย. 2569)
  - `StorageService` created with local/oracle/s3 backends
  - `POST /profile/upload-image` now calls `storage.upload()` and returns real URL
  - `POST /profile/seeker/verify` stores real uploaded license URL via `storage.upload()`

- [x] Add full license verification workflow (admin review) (5 เม.ย. 2569)
  - `PATCH /profile/admin/seeker/:userId/verify` endpoint added
  - Approve sets `license_verified=true`; reject sets `license_rejection_reason`
  - Audit log written for both outcomes; seeker notification sent on rejection

- [x] Implement scheduled auto-expire / auto-close jobs (5 เม.ย. 2569)
  - `JobSchedulerService` created with `@Cron(EVERY_HOUR)` handler
  - Marks overdue Open jobs as EXPIRED every hour
  - Marks filled jobs CLOSED nightly at 02:00 via raw SQL
  - Registered in `JobModule` providers

- [x] Complete chat conversation behavior for all conversation types (5 เม.ย. 2569)
  - `markRead` now accepts `?type=match|booking` query param
  - Uses `booking_id` when type is `booking`, `match_id` otherwise

- [x] Integrate AI slip verification pipeline in payment flow (5 เม.ย. 2569)
  - `SlipVerificationService` created — calls GPT-4o Vision to extract amount/date/bank/reference from slip image
  - `POST /payments/upload-slip` now stores slip via `StorageService`, creates payment record, and triggers async AI verification
  - Auto-updates booking `payment_status → FULLY_PAID` on APPROVED; falls back to MANUAL_REVIEW on low confidence
  - Mock extraction used when `OPENAI_API_KEY` is not set (safe for dev)
  - Fixed: `profile.bridge.controller.ts` curly apostrophe syntax error; `booking.controller.ts` non-existent fields (`bank_name`, `payment` → `payments`); `storage.service.ts` `Buffer` BodyInit cast; Prisma client regenerated after migration

- [x] Add real push notifications (FCM/APNs) (5 เม.ย. 2569)
  - `NotificationService` now initializes `firebase-admin` via `FIREBASE_SERVICE_ACCOUNT_JSON` env
  - Sends FCM push on every `create()` call when user has `fcm_token`
  - Graceful fallback: stores DB record if FCM token absent or firebase not configured

- [x] Standardize API error handling (5 เม.ย. 2569)
  - All `throw new Error(...)` replaced with `NotFoundException` in chat, booking, payment, map controllers

- [x] Expand automated tests (5 เม.ย. 2569)
  - `auth.service.spec.ts` — 17 test cases: register, login, sendOtp, verifyOtp, refreshToken
  - `job.service.spec.ts` — 8 test cases: createJob, browseJobs (radius filter), applyToJob, acceptApplicant
  - `booking.service.spec.ts` — 6 test cases: createBooking (conflict), getAvailableSlots, cancelBooking
  - `slip-verification.service.spec.ts` — 6 test cases: evaluate() APPROVED/REJECTED/MANUAL_REVIEW, verifySlip mock mode
  - `notification.service.spec.ts` — 4 test cases: DB record, FCM send, FCM skip (no token), FCM skip (not ready)
  - Total: 46 tests, all passing ✅

- [x] Add OTP registration + email-based auth (5 เม.ย. 2569)
  - Schema: `OtpCode` model, `User.is_verified`, `User.fcm_token`, phone fields optional
  - `register()` now returns `{userId, message}` and sends OTP; `verifyOtp()` returns tokens
  - `login()` supports both email and phone lookup
  - Migration `20260404132336_add_otp_fcm_verification_fields` applied

### Mobile (medmatch-mobile)

- [x] Implement role-based post-login routing (5 เม.ย. 2569)
  - `app/index.tsx` now routes: CLINIC→clinic-dashboard, SEEKER→jobs, PATIENT→home

- [x] Complete biometric login refresh flow (5 เม.ย. 2569)
  - `login.tsx` calls real `POST /auth/refresh` with SecureStore token
  - Stores new refreshToken on success; deletes stale token on failure

- [x] Complete register + OTP verification flow (5 เม.ย. 2569)
  - `register.tsx` navigates to `/(auth)/otp-verify` with userId+email params
  - `otp-verify.tsx` created: 6-digit input with auto-advance, verify + resend

- [x] Connect job swipe actions to real API (5 เม.ย. 2569)
  - `handleSwipeRight` now calls `POST /jobs/${job.id}/apply`
  - Shows `Alert` on failure with server error message

- [x] Replace chat room mock data with real message history + E2EE flow (5 เม.ย. 2569)
  - `chat/[id].tsx` loads history from `GET /chat/${id}/messages?type=...&limit=50`
  - `type` param passed from navigation params
  - Marks read on mount via `PATCH /chat/${id}/read?type=...`
  - Removed hardcoded mock message

- [x] Remove fallback mock jobs in production flow (5 เม.ย. 2569)
  - Catch block now sets `setJobs([])` — no more mock data injection

- [x] Fix tab bar layout — register ALL screens in `(app)/_layout.tsx` (5 เม.ย. 2569)
  - Root cause: only 7-8 of 20 screen files were listed; unlisted screens auto-generated as visible tabs
  - All 20 screens now explicitly listed per role with `href: null` for non-tab screens
  - CLINIC: Dashboard / My Jobs / Chat / Profile
  - SEEKER: Find Jobs / Calendar / Chat / Profile
  - PATIENT: Home / Bookings / Chat / Profile
  - Added `CalendarIcon` import from lucide-react-native for Seeker/Patient tabs

- [x] Add geocoding search to Home map screen (5 เม.ย. 2569)
  - Uses Nominatim (OpenStreetMap) free geocoding API — no API key needed
  - Search bar now geocodes location names (e.g. "เชียงใหม่") and animates map to result
  - Falls back to clinic name search via backend API if geocoding returns no results
  - Country code limited to `th` for Thai-centric results

- [x] Fix Profile screen Dynamic Island overlap on iPhone (5 เม.ย. 2569)
  - Added `useSafeAreaInsets()` to `profile.tsx`
  - Applied `paddingTop: insets.top + spacing.sm` to ScrollView content
  - Content now properly clears the Dynamic Island / notch area

- [x] Fix booking available-slots route mismatch (10 เม.ย. 2569)
  - Added `GET /booking/available-slots?clinicId=&date=` alias in `booking.controller.ts`
  - Transforms service response `{startTime, endTime, available}` → `{id, time, endTime, available}` for mobile
  - Also normalized booking `POST /booking` to accept both camelCase (`clinicId`, `bookingDate`) and snake_case (`clinic_id`, `date`, `time_slot`) field names

- [x] Fix job matches route mismatch (10 เม.ย. 2569)
  - `calendar.tsx` changed from `api.get('/job/my-matches')` → `api.get('/jobs/matches')` to match backend `@Controller('jobs')` `@Get('matches')`

- [x] Add PUT /profile/patient endpoint (10 เม.ย. 2569)
  - Upsert endpoint in `profile.bridge.controller.ts` — accepts `full_name, phone, date_of_birth, allergies, medical_notes, profile_image_url`
  - All PII fields encrypted via `EncryptionService.encrypt()` before storage
  - Audit log written on update

- [x] Create patient-profile/edit.tsx screen (10 เม.ย. 2569)
  - Full profile editor: avatar picker, full name, phone, DOB, blood type chips (8 options), allergies, medical notes
  - Calls `PUT /profile/patient` on save, uploads avatar via `POST /profile/upload-image`
  - Linked from `profile.tsx` "Set Up Profile" button and "Edit Profile" menu for PATIENT role
  - Registered as hidden screen in `_layout.tsx` for all roles

- [x] Create booking/clinic-today.tsx screen (10 เม.ย. 2569)
  - Clinic's daily booking management: fetches `GET /booking/clinic/today`
  - Stats bar (Total/Pending/Confirmed/Done), date display, booking cards with time/status/patient/service
  - Confirm and Complete action buttons per booking
  - Registered as hidden screen in `_layout.tsx` for all roles

- [x] Add real GPS location to Home screen (10 เม.ย. 2569)
  - Installed `expo-location` package
  - Requests foreground permission on mount, gets `getCurrentPositionAsync` with Balanced accuracy
  - Animates map to real GPS position and fetches nearby clinics
  - Falls back to Bangkok coordinates if permission denied
  - "My Location" button returns to GPS position instead of hardcoded Bangkok

- [x] Add advanced job filter modal to SEEKER jobs screen (10 เม.ย. 2569)
  - Filter bottom sheet: specialty chips (8 options), radius buttons (5/10/20/50/100 km), min pay, date, sort order
  - `pendingFilters` while modal open → applied on "Apply Filters" (cancel-safe)
  - Active filters shown as dismissable chips; filter badge shows count of active filters
  - GPS coordinates passed to `browseJobs` query params along with all filters

- [x] Create income.tsx — Income Summary screen for SEEKER (10 เม.ย. 2569)
  - Year total earnings banner, month picker, 6-month bar chart (native Views)
  - Stats grid: Month Total, Shifts, Completed pay, Upcoming pay
  - Per-clinic breakdown and shift history list
  - Fetches `GET /jobs/matches`; registered in `_layout.tsx`

- [x] Create patient-records.tsx — Patient Records screen for CLINIC (10 เม.ย. 2569)
  - Groups bookings from `GET /booking/clinic/today` by patient
  - Searchable patient list with visit count, last visit, total spent
  - Patient detail modal with full visit history, status icons, amounts
  - Registered in `_layout.tsx`; linked from `profile.tsx` CLINIC section

- [x] Create treatment-history.tsx — Treatment History for PATIENT (10 เม.ย. 2569)
  - Timeline layout grouped by year-month, 3 tabs (All/Upcoming/Completed)
  - Summary banner: completed count, upcoming count, total spent
  - Each card taps to payment screen; fetches `GET /booking/my`
  - Registered in `_layout.tsx`; linked from `profile.tsx` PATIENT section

- [x] Create favorites.tsx — Saved Clinics for PATIENT (10 เม.ย. 2569)
  - Saves/loads clinic IDs to `AsyncStorage` key `@medmatch_favorite_clinics`
  - Fetches each saved clinic via `GET /profile/clinic/:id`
  - Remove with Alert confirm, "Book Now" quick-action, empty state → Explore Clinics
  - Registered in `_layout.tsx`; linked from `profile.tsx` PATIENT section

- [x] Add revenue bar chart to accounting.tsx (10 เม.ย. 2569)
  - 6-month bar chart using native Views with percentage heights
  - Shows verified revenue per month; current month highlighted in solid color
  - Added chart styles: `chartCard`, `chartBars`, `chartBarItem`, `chartBarTrack`, `chartBarFill`

- [x] Add heart/favorite button to Home screen clinic cards (10 เม.ย. 2569)
  - Heart icon on each clinic card in bottom sheet; filled when saved
  - Reads/writes `@medmatch_favorite_clinics` in AsyncStorage on tap
  - State syncs with favorites.tsx on next load

- [x] Add Phase 2 navigation links to profile.tsx (10 เม.ย. 2569)
  - SEEKER section: "Income Summary" → `/(app)/income`
  - CLINIC section: "Today's Appointments", "Patient Records", "Accounting" links added
  - PATIENT section: "Treatment History" → `/(app)/treatment-history`, "Saved Clinics" → `/(app)/favorites`

- [x] Fix chat/[id].tsx missing `api` import + hardcoded participant name (10 เม.ย. 2569)
  - Added missing `import { api }` — was called but never imported (runtime crash)
  - Added `name` param to `useLocalSearchParams`; falls back to fetching `/chat/conversations` if absent
  - Replaced hardcoded "Dr. Somchai" with dynamic `{participantName || 'Chat'}`
  - Updated `chat.tsx` to pass `name: item.participant_name` when navigating to room

- [x] Add cancel booking to my-bookings.tsx (10 เม.ย. 2569)
  - Cancel button shown below each PENDING/CONFIRMED card in UPCOMING tab
  - Confirmation alert before calling `PUT /booking/:id/cancel`
  - Optimistically updates local state to CANCELLED on success

- [x] Add `GET /booking/services?clinicId=` backend endpoint (10 เม.ย. 2569)
  - Returns active `ClinicService` records for a clinic (id, name, price, duration, description)
  - Added to `booking.controller.ts` before slots route to prevent shadowing

- [x] Add `GET /reviews/clinic-profile/:id` backend endpoint (10 เม.ย. 2569)
  - Resolves clinic profile ID → `user_id`, then queries reviews with reviewer identity
  - Returns `{ data, total, rating_avg, rating_count }`
  - Added to `review.controller.ts`

- [x] Add service picker + reviews to clinic booking page (10 เม.ย. 2569)
  - `booking/clinic/[id].tsx`: fetches services in parallel with clinic profile
  - Service selection cards appear above calendar (only if clinic has services)
  - `serviceId` passed to `POST /booking` on confirm
  - Reviews section appended after time slots — shows star ratings, dates, comments
  - Fetches `GET /reviews/clinic-profile/:id`

- [x] Add unread notification badge to profile.tsx (10 เม.ย. 2569)
  - Fetches `GET /notifications` on mount, counts unread items
  - Red badge with count shown on Notifications menu item when > 0

- [x] Add Job Detail Modal to jobs/index.tsx (10 เม.ย. 2569)
  - "View Job Details" link below swipe stack opens bottom-sheet modal for top card
  - Modal shows pay/date/hours highlights, location, specialty, full description
  - "Pass" and "Apply Now" action buttons inside modal trigger same swipe handlers

### Phase 4 — Production Readiness (11 เม.ย. 2569)

#### Backend

- [x] Add `PATCH /auth/fcm-token` endpoint (11 เม.ย. 2569)
  - Saves FCM push token for current authenticated user
  - Validates `fcm_token` field is present; updates `User.fcm_token` in DB

- [x] Add `PATCH /auth/change-password` endpoint (11 เม.ย. 2569)
  - Validates current password via `EncryptionService.verifyPassword()`
  - Enforces 8-char minimum; hashes new password before storing

- [x] Add `DELETE /auth/account` endpoint (11 เม.ย. 2569)
  - PDPA Right to Delete — calls `authService.deleteAccount()` with audit log

- [x] Add `GET /profile/seeker/:id` — public seeker profile view (11 เม.ย. 2569)
  - Returns full_name, specialty, years_experience, bio, specialties, average_rating, review_count, profile_image_url, is_verified
  - Placed AFTER `seeker/me` and `seeker/verification-status` to avoid route shadowing

- [x] Add `PUT /jobs/:id` — edit job posting (11 เม.ย. 2569)
  - Ownership verification (clinic_id must match user's profile)
  - Only OPEN-status jobs can be edited

#### Mobile

- [x] Create seeker-profile/[id].tsx — public seeker profile (11 เม.ย. 2569)
  - Avatar, specialty badge, stats row (experience/rating/reviews), bio, skills chips
  - Verification status indicator, recent reviews section
  - Fetches `GET /profile/seeker/:id` and `GET /reviews/user/:userId`

- [x] Create clinic-profile/[id].tsx — public clinic profile (11 เม.ย. 2569)
  - Hero image, metadata (address/chairs/hours), description, consultation fee
  - Services list, reviews section, "Book Appointment" sticky bottom bar
  - Fetches `GET /profile/clinic/:id`, `GET /booking/services`, `GET /reviews/clinic-profile/:id`

- [x] Create settings.tsx — Account settings screen (11 เม.ย. 2569)
  - Account info display (email, role, ID)
  - Change password form (current/new/confirm) → `PATCH /auth/change-password`
  - Danger zone: double-confirmation account deletion → `DELETE /auth/account`

- [x] Create jobs/[id]/edit.tsx — job editing form (11 เม.ย. 2569)
  - Pre-loads job data from `GET /jobs/:id`
  - Specialty chips, date/time fields, pay/slots, negotiable toggle, requirements/benefits
  - Saves via `PUT /jobs/:id`

- [x] Add "View Full Profile" to jobs/[id]/applicants.tsx (11 เม.ย. 2569)
  - Button navigates to `seeker-profile/${item.seeker.id}`

- [x] Add Edit + Repost to jobs/my-jobs.tsx (11 เม.ย. 2569)
  - Edit button (Edit3 icon) for OPEN jobs → navigates to `jobs/[id]/edit`
  - Repost Modal with TextInput for date → creates new job copy

- [x] Add clinic profile link to calendar.tsx (11 เม.ย. 2569)
  - `clinic_id` added to WorkDay jobs interface
  - Clinic name is tappable → navigates to `clinic-profile/[id]`

- [x] Add Settings link to profile.tsx (11 เม.ย. 2569)
  - "Settings" MenuItem in Account section → `/(app)/settings`

- [x] Register Phase 4 screens in _layout.tsx (11 เม.ย. 2569)
  - `seeker-profile/[id]`, `clinic-profile/[id]`, `settings`, `jobs/[id]/edit` added as hidden screens in all 3 roles

- [x] Integrate push notifications on mobile (11 เม.ย. 2569)
  - Installed `expo-notifications` + `expo-device` packages
  - Created `src/services/pushNotifications.ts` — requests permission, gets Expo push token, sends to backend via `PATCH /auth/fcm-token`
  - `login.tsx` calls `registerForPushNotifications()` after both email login and biometric login (non-blocking)
  - `app/_layout.tsx` handles notification taps → routes to chat/booking/notifications screens
  - `app.json` updated with `expo-notifications` plugin config
  - Android notification channel configured with MedMatch brand color

### Bug Fix Round (11 เม.ย. 2569)

#### Backend

- [x] Add `GET /jobs/:id` endpoint (11 เม.ย. 2569)
  - Returns single job with clinic info (name, address, coordinates, image)
  - Placed BEFORE `GET :id/applicants` to avoid route ordering issues
  - Fixes job edit screen crash — `jobs/[id]/edit.tsx` was calling this endpoint on mount

- [x] Fix PUT /jobs/:id wrong field names (11 เม.ย. 2569)
  - `is_negotiable` → `pay_negotiable` (correct Prisma schema field)
  - `slots_needed` → `slots` (correct Prisma schema field)
  - Fixes silent bug where Negotiable toggle and Slots count were not saving

- [x] Fix GET /booking/clinic/today missing patient name (11 เม.ย. 2569)
  - `booking.service.ts` had `first_name_enc: false` (explicitly excluded)
  - Changed to `first_name_enc: true, last_name_enc: true` so clinic staff see patient names

- [x] Add pagination to GET /notifications (11 เม.ย. 2569)
  - `notification.service.ts` `getForUser()` now accepts `page` param, returns `{ data, total, page, hasMore }`
  - Default page size changed from 50 → 20
  - Controller accepts `?page=&limit=` query params

#### Mobile

- [x] OTP resend cooldown timer (11 เม.ย. 2569)
  - 60-second countdown after each send, using `setInterval` + `useRef` for cleanup
  - Resend button disabled and shows "Resend in Xs" during cooldown
  - Prevents OTP spam / unnecessary API calls

- [x] notifications.tsx pagination + infinite scroll (11 เม.ย. 2569)
  - `loadMore()` function loads next page on `onEndReached`
  - Footer `ActivityIndicator` shown while loading more
  - Pull-to-refresh resets to page 1

- [x] profile.tsx unread badge uses dedicated endpoint (11 เม.ย. 2569)
  - Was calling `GET /notifications` and filtering client-side (broke with pagination)
  - Now calls `GET /notifications/unread-count` → `{ count }` for accuracy

### UX Improvements (11 เม.ย. 2569)

- [x] Replace manual date/time text inputs with picker components (11 เม.ย. 2569)
  - Created `src/components/common/DatePickerField.tsx` — Calendar modal using `react-native-calendars`, displays Thai-formatted date, supports minDate
  - Created `src/components/common/TimePickerField.tsx` — scrollable time list modal with 30-min intervals, shows both 12h and 24h format, auto-scrolls to selected time
  - `jobs/post.tsx`: Work Date, Start Time, End Time now use picker components instead of TextInput
  - `jobs/[id]/edit.tsx`: Same — DatePickerField + TimePickerField replace raw TextInput
  - `jobs/my-jobs.tsx`: Repost modal replaced TextInput with inline Calendar picker, shows Thai date preview, disabled Repost button until date selected
  - Installed `@react-native-community/datetimepicker` package (Expo-compatible)
  - Eliminates YYYY-MM-DD / HH:MM format errors — users can only select valid dates/times

- [x] Add nationwide job search + custom location search (11 เม.ย. 2569)
  - Backend: `BrowseJobsDto` `latitude`/`longitude` now optional — omitting returns all jobs nationwide
  - Backend: `browseJobs()` skips location filter when no coordinates sent, calculates `distance_km: null` for nationwide results
  - Mobile: Added "ทั่วประเทศ" (Nationwide) chip in radius filter (value=0)
  - Mobile: Location search via Nominatim geocoding — type "เชียงใหม่" to search jobs near Chiang Mai
  - Mobile: `searchLocation`, `searchLat`, `searchLng` in Filters state — overrides GPS when set
  - Mobile: Header subtitle shows "ทั่วประเทศ" or custom location name
  - Mobile: Active filter chips show location/nationwide badges
  - Mobile: Filter date field also uses `DatePickerField` component (no more manual typing)
  - Use case: Seeker in Bangkok can browse jobs in Chiang Mai before traveling

### API Contract Testing & Comprehensive Bug Fix (11 เม.ย. 2569)

#### Test Suite Created (66 tests total)

- [x] `tests/integration/auth.flow.spec.ts` — 14 auth lifecycle tests (11 เม.ย. 2569)
  - Register, login, OTP send/verify, token refresh, FCM token, change password, delete account

- [x] `tests/integration/job-matching.flow.spec.ts` — 24 job flow tests (11 เม.ย. 2569)
  - Post job, browse/filter, apply, accept/reject, matches, close/repost, with inline bug documentation

- [x] `tests/integration/booking.flow.spec.ts` — 15 booking/payment/review flow tests (11 เม.ย. 2569)
  - Available slots, services, create booking, confirm/complete/cancel, payment upload, reviews

- [x] `tests/integration/api-contract.spec.ts` — 13 mobile↔backend contract tests (11 เม.ย. 2569)
  - Systematic comparison of what mobile sends vs what backend expects for every endpoint

- [x] `tests/integration/BUG-REPORT.md` — Full 12-bug report (11 เม.ย. 2569)
  - 4 CRITICAL, 5 HIGH, 3 MEDIUM bugs documented with severity, fix steps, file references

#### Critical Bug Fixes (BUG-001 through BUG-004)

- [x] Fix applicants.tsx — All 4 API URLs used `/job/` instead of `/jobs/` (BUG-001) (11 เม.ย. 2569)
  - `GET /job/${id}` → `GET /jobs/${id}`, `GET /job/${id}/applicants` → `GET /jobs/${id}/applicants`
  - Accept/reject completely restructured: `/job/${id}/accept/${aid}` → `/jobs/applicants/${aid}/accept` (BUG-002)

- [x] Add `GET /map/clinics/preview` endpoint to backend (BUG-003, BUG-008) (11 เม.ย. 2569)
  - New endpoint in `map.controller.ts` — accepts lat/lng/radiusKm query params
  - Queries ClinicProfile by location bounds using Haversine formula
  - Returns clinic_name, address, coordinates, image, specialties for map display

- [x] Fix review/[id].tsx — Wrong URL, wrong fields, missing required field (BUG-004) (11 เม.ย. 2569)
  - URL: `/review` → `/reviews`
  - Field: `booking_id` → `bookingId` (camelCase)
  - Added `revieweeId` — fetches booking details first to get clinic user ID

#### High Bug Fixes (BUG-005 through BUG-008)

- [x] Fix applicants.tsx — Interface field names don't match backend response (BUG-005) (11 เม.ย. 2569)
  - `full_name` → `first_name` + `last_name`, `specialty` → `license_type`
  - `years_experience` → `experience_years`, `average_rating` → `rating_avg`
  - `review_count` → `rating_count`, `is_verified` → `license_verified`

- [x] Fix my-jobs.tsx — Interface reads wrong field names (BUG-006) (11 เม.ย. 2569)
  - `application_count` → `_count?.applications`, `match_count` → `_count?.matches`
  - `slots_needed` → `slots`, `pay_negotiable` field added to interface

- [x] Fix edit.tsx — Reads wrong field names when loading job data (BUG-007) (11 เม.ย. 2569)
  - `job.is_negotiable` → `job.pay_negotiable`, `job.slots_needed` → `job.slots`

#### Medium Bug Fixes (BUG-010 through BUG-012)

- [x] Fix notifications.tsx — Stale page closure in fetchNotifications (BUG-010) (11 เม.ย. 2569)
  - Simplified `fetchNotifications` to always reset to page 1 (used for initial load + pull-to-refresh only)
  - `loadMore` handles pagination independently — no more stale closure issue

- [x] Fix calendar.tsx — Reads clinic from wrong nested path (BUG-011) (11 เม.ย. 2569)
  - Backend returns `m.clinic` (sibling of `m.job`), not `m.job.clinic`
  - Changed `m.job?.clinic?.clinic_name` → `m.clinic?.clinic_name` etc.
  - Added `id: true` to clinic select in `job.service.ts` `getMyMatches()` for navigation

- [x] Fix clinic-today.tsx — Patient names displayed as encrypted blobs (BUG-012) (11 เม.ย. 2569)
  - `booking.controller.ts`: Injected `EncryptionService`, decrypts `first_name_enc`/`last_name_enc` before returning
  - Returns decrypted `first_name`/`last_name` alongside encrypted fields
  - `clinic-today.tsx`: Shows `first_name last_name` when available, falls back to `Patient #ID`

### Phase 5 — Job Matching Flow & UX Improvements (12 เม.ย. 2569)

#### Backend

- [x] Add notifications on accept/reject applicant (12 เม.ย. 2569)
  - Injected `NotificationService` into `JobService` via `NotificationModule` import
  - `acceptApplicant` sends `JOB_ACCEPTED` notification to seeker with job_id meta
  - `rejectApplicant` sends `JOB_REJECTED` notification to seeker with job_id meta
  - Graceful error handling — notification failure doesn't block the accept/reject operation

- [x] Add `GET /jobs/my-applications` endpoint for seekers (12 เม.ย. 2569)
  - Returns all applications with job details (title, date, time, pay, clinic name/address)
  - Ordered by `created_at` desc (newest first)
  - Placed BEFORE `:id` routes to avoid route shadowing

- [x] Add `POST /jobs/applications/:id/withdraw` endpoint (12 เม.ย. 2569)
  - Allows seekers to cancel pending applications
  - Validates ownership (seeker_id must match) and status (only PENDING can be withdrawn)
  - Sets status to `CANCELLED`

#### Mobile

- [x] Fix clinic profile photo not showing (12 เม.ย. 2569)
  - `profile.tsx` now checks both `profile_image_url` and `profile.images[0]` for avatar
  - Clinic backend returns `images` (JSON array), not `profile_image_url`

- [x] Fix applicants card UI spacing (12 เม.ย. 2569)
  - Increased `specialty` marginBottom from 4px to `spacing.sm`
  - Added `marginTop: spacing.sm` to `viewProfileBtn` for breathing room

- [x] Fix View Full Profile blank page (12 เม.ย. 2569)
  - `seeker-profile/[id].tsx`: Added proper error state when profile fails to load
  - Shows "Profile not found" with User icon and "Go Back" button instead of blank page

- [x] Create my-applications.tsx — My Applications screen for SEEKER (12 เม.ย. 2569)
  - Filter tabs: ALL, PENDING, ACCEPTED, REJECTED, CANCELLED
  - Application cards: job title, clinic name, date/time, pay, status pill
  - Withdraw button for PENDING applications with confirmation alert
  - "View on Calendar" link for ACCEPTED applications
  - Pull-to-refresh, empty state with "Find Jobs" CTA
  - Registered in `_layout.tsx` for all roles, linked from `profile.tsx` SEEKER section

- [x] Filter already-applied jobs from swipe stack (12 เม.ย. 2569)
  - `jobs/index.tsx`: Fetches existing applications on mount via `GET /jobs/my-applications`
  - Stores applied job IDs in a Set, filters them out of browse results
  - No more "Already applied to this job" errors — jobs already applied to don't appear
  - Applied count reflects server-side data (not just session count)

### Phase 5.1 — Seeker Confirmation Flow (12 เม.ย. 2569)

#### Backend

- [x] Add `SEEKER_PENDING` to MatchStatus enum (12 เม.ย. 2569)
  - Prisma migration `20260411171458_add_seeker_pending_status` applied
  - New flow: Clinic Accept → Match created as `SEEKER_PENDING` → Seeker Confirm/Decline → `CONFIRMED`

- [x] Refactor acceptApplicant — no longer auto-confirms (12 เม.ย. 2569)
  - Creates Match with `SEEKER_PENDING` status instead of `CONFIRMED`
  - Does NOT increment `filled_slots` yet (waits for seeker confirmation)
  - Notification message changed to "Job Offer Received! Please confirm or decline."
  - Includes `match_id` in notification meta for deep linking

- [x] Add `POST /jobs/matches/:id/confirm` endpoint (12 เม.ย. 2569)
  - Seeker confirms → Match becomes `CONFIRMED`, `filled_slots` incremented, auto-closes if full
  - Sends `JOB_MATCH` notification to clinic: "Seeker Confirmed!"

- [x] Add `POST /jobs/matches/:id/decline` endpoint (12 เม.ย. 2569)
  - Seeker declines → Match becomes `CANCELLED`, slot stays open
  - Sends notification to clinic: "Seeker Declined. The slot is still open."

#### Mobile

- [x] Add "Pending Offers" section to my-applications.tsx (12 เม.ย. 2569)
  - Fetches matches and filters `SEEKER_PENDING` ones
  - Warning-colored banner shows pending offers at top of screen
  - Each offer card: job title, clinic name, date/time, pay
  - Confirm/Decline buttons with confirmation alerts
  - Calls `POST /jobs/matches/:id/confirm` or `decline`

- [x] Update calendar.tsx for SEEKER_PENDING status (12 เม.ย. 2569)
  - Added `SEEKER_PENDING: colors.semantic.warning` to status color map
  - Added "Pending" legend item in warning/yellow color
  - SEEKER_PENDING jobs now show as yellow dots on calendar

### Phase 5.2 — Navbar, Badges & Calendar Detail Modal (12 เม.ย. 2569)

#### Mobile

- [x] Add "Applications" as visible tab in SEEKER navbar (12 เม.ย. 2569)
  - SEEKER tabs now: Find Jobs → Applications → Calendar → Chat → Profile (5 tabs)
  - `my-applications` moved from hidden to visible tab with `ClipboardList` icon
  - Tab badge shows pending offer count (red circle with number)
  - Removed back button from my-applications header (now a tab screen)

- [x] Add notification badges to navbar for all roles (12 เม.ย. 2569)
  - Profile tab shows unread notification count badge for SEEKER, CLINIC, and PATIENT
  - Fetches badge counts on mount + every 30 seconds via polling
  - Badge uses `tabBarBadge` with red background

- [x] Add Job Detail Modal to calendar.tsx (12 เม.ย. 2569)
  - Shift cards are now tappable → opens bottom-sheet modal
  - Modal shows: status pill, job title, clinic name (tappable), date, time, location, pay
  - Close button at bottom
  - SEEKER_PENDING status displays as "Pending Confirmation" in modal

- [x] Navigate to Calendar after Seeker confirms job (12 เม.ย. 2569)
  - `handleConfirmOffer` now shows alert with "View Calendar" button → navigates to `/(app)/calendar`
  - Seeker can immediately see the confirmed job on their calendar

## Update Rule

- Every completed task must be reflected in this file immediately.
- When a task is done:
  - Change `[ ]` to `[x]`
  - Add completion date next to the item
  - Add short implementation note under that item

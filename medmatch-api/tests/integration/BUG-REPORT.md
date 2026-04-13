# MedMatch Bug Report

Generated: 11 April 2569
Source: Full-stack API contract testing (Mobile UI → Backend)

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 CRITICAL | 4 | App crash / complete feature broken |
| 🟠 HIGH | 5 | Feature partially broken |
| 🟡 MEDIUM | 3 | Wrong data displayed |
| Total | **12** bugs |

---

## 🔴 CRITICAL BUGS

### BUG-001: applicants.tsx — Wrong URL prefix (`/job/` vs `/jobs/`)
**Files:** `app/(app)/jobs/[id]/applicants.tsx` lines 56-57, 77, 79
**Impact:** Applicants screen completely broken — all 4 API calls return 404

| Line | Mobile sends | Backend expects |
|------|-------------|----------------|
| 56 | `GET /job/${id}` | `GET /jobs/${id}` |
| 57 | `GET /job/${id}/applicants` | `GET /jobs/${id}/applicants` |
| 77 | `POST /job/${id}/accept/${applicantId}` | `POST /jobs/applicants/${applicantId}/accept` |
| 79 | `POST /job/${id}/reject/${applicantId}` | `POST /jobs/applicants/${applicantId}/reject` |

**Fix:** Change all 4 URLs + restructure accept/reject paths

---

### BUG-002: applicants.tsx — Accept/Reject URL structure completely wrong
**Files:** `app/(app)/jobs/[id]/applicants.tsx` lines 77, 79
**Impact:** Clinic cannot accept or reject any applicant

The backend routes are:
```
POST /jobs/applicants/:applicationId/accept
POST /jobs/applicants/:applicationId/reject
```

But mobile sends:
```
POST /job/:jobId/accept/:applicantId
POST /job/:jobId/reject/:applicantId
```

Completely different URL structure — not just singular vs plural.

**Fix:**
```typescript
// Line 77: Change from:
await api.post(`/job/${id}/accept/${applicantId}`);
// To:
await api.post(`/jobs/applicants/${applicantId}/accept`);

// Line 79: Change from:
await api.post(`/job/${id}/reject/${applicantId}`);
// To:
await api.post(`/jobs/applicants/${applicantId}/reject`);
```

---

### BUG-003: home.tsx — Calls non-existent endpoint
**Files:** `app/(app)/home.tsx` line 88
**Impact:** Home screen map shows no clinics

Mobile calls:
```
GET /map/clinics/preview?latitude=...&longitude=...&radiusKm=...
```

But backend `MapController` only has:
```
GET /map/clinic/:id/preview   (single clinic by ID)
GET /map/jobs/heatmap          (job heatmap)
GET /map/search                (geocoding)
GET /map/directions            (directions)
```

**There is no bulk clinic search endpoint!**

**Fix:** Add `GET /map/clinics/nearby` endpoint to `MapController` that queries ClinicProfile by location bounds.

---

### BUG-004: review/[id].tsx — Wrong URL + missing required fields
**Files:** `app/(app)/review/[id].tsx` line 38
**Impact:** Creating reviews fails (404 + validation error)

| Issue | Mobile | Backend |
|-------|--------|---------|
| URL | `POST /review` | `POST /reviews` |
| booking_id | `booking_id` (snake) | `bookingId` (camel) |
| revieweeId | **NOT SENT** | **REQUIRED** |
| aspect_ratings | Sent | Not in schema |

**Fix:**
```typescript
// Change from:
await api.post('/review', { booking_id: id, rating, comment, aspect_ratings });
// To:
await api.post('/reviews', { bookingId: id, revieweeId: clinicUserId, rating, comment });
```

---

## 🟠 HIGH BUGS

### BUG-005: applicants.tsx — Interface field names don't match backend response
**Files:** `app/(app)/jobs/[id]/applicants.tsx` interface Applicant (lines 11-25)
**Impact:** All applicant data shows as undefined/empty

| Mobile reads | Backend returns | Displayed as |
|-------------|----------------|--------------|
| `seeker.full_name` | `seeker.first_name` + `seeker.last_name` | `undefined` |
| `seeker.specialty` | `seeker.license_type` | `undefined` |
| `seeker.years_experience` | `seeker.experience_years` | `undefined` |
| `seeker.average_rating` | `seeker.rating_avg` | `undefined` |
| `seeker.review_count` | `seeker.rating_count` | `undefined` |
| `seeker.is_verified` | `seeker.license_verified` | `undefined` |

**Fix:** Update the Applicant interface OR update the backend select query to alias fields.

---

### BUG-006: my-jobs.tsx — Reads wrong field names from API response
**Files:** `app/(app)/jobs/my-jobs.tsx` interface Job (lines 11-25)
**Impact:** Job cards show wrong counts and "undefined" for slots

| Mobile reads | Backend returns | Value |
|-------------|----------------|-------|
| `item.application_count` | `item._count.applications` | `undefined` |
| `item.match_count` | `item._count.matches` | `undefined` |
| `item.slots_needed` | `item.slots` | `undefined` |

**Fix:** Either flatten in backend response OR update mobile reads:
```typescript
// Change:
{item.application_count} applicants · {item.match_count}/{item.slots_needed}
// To:
{item._count?.applications ?? 0} applicants · {item._count?.matches ?? 0}/{item.slots ?? 1}
```

---

### BUG-007: edit.tsx — Reads wrong field names when loading job data
**Files:** `app/(app)/jobs/[id]/edit.tsx` lines 51-52
**Impact:** "Negotiable" toggle and "Slots needed" always reset to defaults

```typescript
// Line 51: reads job.is_negotiable → undefined (field is pay_negotiable)
setIsNegotiable(job.is_negotiable || false);  // Always false!
// Should be:
setIsNegotiable(job.pay_negotiable || false);

// Line 52: reads job.slots_needed → undefined (field is slots)
setSlotsNeeded(job.slots_needed ? String(job.slots_needed) : '1');  // Always '1'!
// Should be:
setSlotsNeeded(job.slots ? String(job.slots) : '1');
```

---

### BUG-008: home.tsx — Missing nearby clinics endpoint
**Files:** `app/(app)/home.tsx` line 88, `medmatch-api/src/modules/map/map.controller.ts`
**Impact:** Map screen shows empty (no clinics)

The home screen expects a bulk search endpoint:
```
GET /map/clinics/preview?latitude=13.75&longitude=100.50&radiusKm=10
```

But this endpoint doesn't exist in `MapController`. Need to create it.

---

### BUG-009: SwipeCard distance_km rendering issue
**Files:** `src/components/jobs/SwipeCard.tsx` line 114 (previously fixed)
**Status:** ✅ FIXED — Changed to explicit null check

---

## 🟡 MEDIUM BUGS

### BUG-010: notifications.tsx — Response format changed but some code paths may not handle it
**Files:** `app/(app)/notifications.tsx`
**Impact:** Pull-to-refresh may not reset correctly

The paginated response is `{ data, total, page, hasMore }` but the initial load and refresh both need to parse `.data` from response. Verify `fetchNotifications` handles the new format consistently.

---

### BUG-011: calendar.tsx — Uses match response fields that may not exist
**Files:** `app/(app)/calendar.tsx`
**Impact:** Calendar jobs may show wrong data

The matches response from `GET /jobs/matches` includes:
```typescript
job: { title, work_date, start_time, end_time, pay_amount }
clinic: { clinic_name, address, latitude, longitude }
```

But calendar.tsx may expect `clinic_id` on the job which isn't selected by the service.

---

### BUG-012: clinic-today patient name is encrypted
**Files:** `app/(app)/booking/clinic-today.tsx`
**Impact:** Patient names display as encrypted strings instead of readable names

Backend returns `first_name_enc` and `last_name_enc` which are AES-256-GCM encrypted. Mobile displays them directly without decryption. Need either:
1. Backend to decrypt before sending, or
2. A dedicated endpoint that returns decrypted names

---

## Fix Priority Recommendation

1. **BUG-001 + BUG-002** (applicants.tsx URLs) — Fix first, core feature
2. **BUG-003 + BUG-008** (home.tsx nearby clinics) — Fix second, landing screen
3. **BUG-005 + BUG-006** (field name mismatches) — Fix third, data display
4. **BUG-004** (reviews) — Fix fourth, post-booking flow
5. **BUG-007** (edit.tsx reads) — Fix fifth, job editing
6. **BUG-010-012** (medium) — Fix last, minor issues

---

## Files That Need Changes

### Mobile (9 files):
1. `app/(app)/jobs/[id]/applicants.tsx` — BUG-001, 002, 005
2. `app/(app)/jobs/my-jobs.tsx` — BUG-006
3. `app/(app)/jobs/[id]/edit.tsx` — BUG-007
4. `app/(app)/home.tsx` — BUG-003
5. `app/(app)/review/[id].tsx` — BUG-004
6. `app/(app)/booking/clinic-today.tsx` — BUG-012

### Backend (1 file):
1. `src/modules/map/map.controller.ts` — Add GET /map/clinics/nearby endpoint (BUG-003/008)

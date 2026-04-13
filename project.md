# 🏥 MedMatch — Super App สำหรับวงการทันตกรรม & การแพทย์

## Project Overview

แอปหางาน Part-time + Booking + Clinic Management สำหรับบุคลากรทางการแพทย์
Concept คล้าย Tinder (Job Matching) + Cloudbed (Booking) + Accounting SaaS

---

## 1. Problem Statement

### ฝั่งบุคลากร (หมอ/ทันตแพทย์/เภสัชกร)

- หางาน part-time ผ่าน Facebook Group / LINE Group ซึ่งข้อมูลไม่ real-time
- ต้อง scroll หาโพสต์เก่า ทักไปแล้วพบว่า "ได้คนแล้ว"
- ไม่มีระบบกรองตาม location, วันเวลา, ค่าตอบแทน
- เสียเวลา ซ้ำซ้อน workload สูง

### ฝั่งคลินิก/โรงพยาบาล

- โพสต์หาคนแล้วต้องตอบแชทซ้ำๆ หลายสิบคน
- ลืมลบโพสต์เมื่อได้คนแล้ว → คนทักมาไม่หยุด
- ไม่มีระบบ verify คุณสมบัติของบุคลากร

### ฝั่งคนไข้

- ไม่มีข้อมูลเปรียบเทียบหมอ/คลินิก
- จองนัดต้องโทรหรือทักแชท ไม่สะดวก
- ไม่มีระบบยืนยันการชำระเงินที่ชัดเจน

---

## 2. Ecosystem Architecture

```
                        MedMatch Ecosystem
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                      │
   🅰️ Job Matching      🅱️ Patient Booking     🅲️ Clinic Management
   (หมอ ↔ คลินิก)       (คนไข้ ↔ หมอ/คลินิก)    (คลินิก backend)
        │                     │                      │
        └─────────────────────┼─────────────────────┘
                              │
                    🅳 Payment & Accounting
                    (Slip verification + บัญชี)
```

---

## 3. User Types

| User | ใช้งานอะไร |
|---|---|
| **👨‍⚕️ บุคลากร (Seeker/Provider)** | หางาน part-time, สร้าง public profile, รับ booking จากคนไข้ |
| **🏥 คลินิก (Clinic)** | โพสต์งาน, รับ booking คนไข้, ระบบบัญชี/slip verification |
| **🧑‍🦱 คนไข้ (Patient)** | ดู profile หมอ, booking นัดหมอ/คลินิก, จ่ายเงิน+อัพสลิป |

> **หมายเหตุ:** ใช้ 1 app เดียว + role-based UI — หมอสามารถ switch เป็น Patient ได้

---

## 4. Core Features

### 🅰️ Module: Job Matching (Tinder-style)

#### Flow หลัก

```
คลินิกโพสต์งาน → ระบบแสดงงานตาม filter ของหมอ → หมอ Swipe สนใจ
→ คลินิกเห็นรายชื่อผู้สนใจ → คลินิก Accept → Match!
→ เปิดแชทดีลราคา/รายละเอียด → ยืนยันนัด → ทำงาน → รีวิว
```

#### สิ่งที่ต่างจาก Tinder

- คลินิกโพสต์งาน, หมอเลือกงาน, คลินิก accept จากผู้สนใจ (Tinder + Job Board hybrid)
- มี auto-expire — งานหมดอายุอัตโนมัติเมื่อถึงวันทำงาน หรือเมื่อคลินิกได้คนแล้ว
- Pin location ได้เอง — ไม่จำเป็นต้องใช้ GPS ปัจจุบัน หมอเลือกพื้นที่ที่ต้องการหางานได้

#### ฟีเจอร์ฝั่งบุคลากร (Job Seeker)

| Feature | รายละเอียด |
|---|---|
| **Profile** | ชื่อ, สาขา (ทันตแพทย์/แพทย์/เภสัชกร/อื่นๆ), เลขใบประกอบวิชาชีพ, ประสบการณ์, ทักษะพิเศษ (เช่น endo, ortho, prosth), รูปโปรไฟล์ |
| **Verification** | ยืนยันใบประกอบวิชาชีพผ่านระบบ (ถ่ายรูป + admin verify หรือเชื่อมกับฐานข้อมูลแพทยสภา/ทันตแพทยสภา) |
| **Search & Filter** | เลือกพื้นที่ (ปักหมุดบนแผนที่ + รัศมี), วันที่ต้องการทำงาน, ช่วงเวลา, ค่าตอบแทนขั้นต่ำ, ประเภทงาน |
| **Swipe/Browse** | ดูการ์ดงานที่ match กับ filter → กด "สนใจ" หรือ "ข้าม" |
| **Calendar View** | ดูตารางงานที่รับแล้ว + วันว่างในรูปแบบปฏิทิน |
| **Chat** | แชทกับคลินิกหลัง match เพื่อดีลรายละเอียด |
| **Rating & Review** | ให้คะแนนคลินิกหลังทำงานเสร็จ |
| **Favorite Clinics** | บันทึกคลินิกที่ชอบเพื่อดูงานใหม่ก่อน |

#### ฟีเจอร์ฝั่งคลินิก (Job Poster)

| Feature | รายละเอียด |
|---|---|
| **Business Profile** | ชื่อคลินิก, ที่อยู่, รูปภาพ, เลขที่ใบอนุญาต, รายละเอียดอุปกรณ์/เก้าอี้ทำฟัน, parking, สวัสดิการ |
| **Post Job** | ระบุ: สาขาที่ต้องการ, วันเวลา, ค่าตอบแทน (ระบุตัวเลข หรือ "ต่อรองได้"), ทักษะที่ต้องการ, จำนวนคน |
| **Auto-expire** | งานปิดอัตโนมัติเมื่อ (1) ได้คนครบ (2) ถึงวันทำงาน (3) คลินิกปิดเอง |
| **Applicant Management** | ดูรายชื่อหมอที่กดสนใจ → ดู profile → Accept / Reject |
| **Chat** | คุยรายละเอียดกับหมอที่ match |
| **Quick Re-post** | โพสต์งานซ้ำจาก template เดิมได้เลย (สำหรับคลินิกที่หาคน part-time ประจำ) |
| **Rating & Review** | ให้คะแนนบุคลากรหลังทำงานเสร็จ |

### Matching Algorithm Logic

```
1. หมอตั้ง filter:
   - พื้นที่ (lat/lng + radius) → PostGIS: ST_DWithin()
   - วันที่ต้องการ
   - สาขา
   - ค่าตอบแทนขั้นต่ำ

2. Query jobs ที่:
   - status = 'open'
   - filled_slots < slots
   - อยู่ใน radius ที่กำหนด
   - specialty ตรงกับ license_type
   - work_date ตรงกับวันที่เลือก
   - pay_amount >= minimum (ถ้าระบุ)

3. เรียงลำดับ:
   - ระยะทางใกล้สุด
   - ค่าตอบแทนสูงสุด
   - rating คลินิกสูงสุด
   - โพสต์ล่าสุด
   (ให้ user เลือก sort ได้)

4. แสดงเป็น card → swipe หรือ list view
```

---

### 🅱️ Module: Patient Booking (Cloudbed-style)

#### Concept: Cloudbed แต่สำหรับคลินิก

| Cloudbed (โรงแรม) | MedMatch (คลินิก) |
|---|---|
| ดูห้องว่าง | ดูช่วงเวลาว่างของหมอ/คลินิก |
| จองห้อง online | จองนัดหมอ online |
| Channel Manager (Agoda, Booking.com) | Channel Manager (LINE OA, Facebook, ในแอป) |
| Payment confirmation | Slip verification (AI อ่านสลิป) |
| Guest review | Patient review หมอ/คลินิก |

#### Patient Flow

```
คนไข้เปิดแอป
    → ค้นหาคลินิก/หมอ (ตามพื้นที่, สาขา, rating)
    → ดู Profile หมอ (ประสบการณ์, คลินิกที่เคยทำ, review, ผลงาน)
    → ดูช่วงเวลาว่าง (Calendar)
    → เลือกวัน/เวลา + ประเภทการรักษา
    → ยืนยัน Booking
    → ชำระเงินมัดจำ (ถ้ามี) → อัพสลิป
    → AI ตรวจสลิป → ยืนยันอัตโนมัติ
    → วันนัด: เข้ารับบริการ
    → หลังรักษา: ชำระส่วนที่เหลือ + รีวิว
```

#### Doctor Public Profile (สิ่งที่คนไข้เห็น)

```
┌─────────────────────────────┐
│  👤 ทพ.สมชาย รักฟัน         │
│  ⭐ 4.8 (127 reviews)       │
│  🦷 ทันตแพทย์ทั่วไป          │
│  📋 ประสบการณ์ 8 ปี           │
│                              │
│  🏥 คลินิกที่ทำงาน:           │
│  • Happy Dental นนทบุรี      │
│  • Smile Plus สีลม           │
│  • ABC Dental เชียงใหม่      │
│                              │
│  🎓 ความเชี่ยวชาญ:           │
│  อุดฟัน • ถอนฟัน • รากเทียม  │
│  • จัดฟัน Invisalign         │
│                              │
│  💬 รีวิวล่าสุด:              │
│  "หมอใจดีมาก ไม่เจ็บเลย"     │
│  ─────────────────────────── │
│  [📅 จองนัดหมอ]  [💬 สอบถาม] │
└─────────────────────────────┘
```

#### Booking Calendar System

```
คลินิก/หมอ ตั้งค่า:
├── วันที่เปิดรับ (จ-ศ, จ-ส, กำหนดเอง)
├── ช่วงเวลา (09:00-12:00, 13:00-17:00, 18:00-21:00)
├── Slot duration (30 นาที / 1 ชั่วโมง / กำหนดเอง)
├── ประเภทการรักษาที่เปิดรับ
├── ราคาแต่ละประเภท (หรือ "สอบถาม")
└── Buffer time ระหว่าง slot (15 นาที)

คนไข้เห็น:
├── ปฏิทินแสดง slot ว่าง (เขียว) / เต็ม (แดง)
├── เลือก slot → กรอกอาการ → ยืนยัน
└── ได้รับ confirmation + reminder ก่อนนัด
```

---

### 🅲️ Module: Clinic Management

#### Clinic Dashboard

```
┌─── Clinic Dashboard ────────────────┐
│                                      │
│  📊 วันนี้                            │
│  ├── นัดหมาย: 12 คน                  │
│  ├── รายรับ: ฿38,500                 │
│  └── สลิปรอตรวจ: 2 รายการ            │
│                                      │
│  📅 ตารางนัดหมายวันนี้                │
│  09:00 คุณสมศรี - อุดฟัน (ยืนยันแล้ว) │
│  10:00 คุณวิชัย - ขูดหินปูน (รอชำระ)  │
│  11:00 ว่าง                          │
│  13:00 คุณนภา - รากเทียม (ยืนยันแล้ว) │
│                                      │
│  💰 สลิปล่าสุด                       │
│  ✅ คุณสมศรี ฿2,500 - ตรวจสอบแล้ว    │
│  ⚠️ คุณวิชัย ฿1,800 - จำนวนไม่ตรง   │
│                                      │
│  [👨‍⚕️ หาหมอ] [📅 จัดการนัด] [💰 บัญชี]│
└──────────────────────────────────────┘
```

---

### 🅳 Module: Payment & Accounting (Slip Verification)

#### Integration กับระบบบัญชีที่มีอยู่

```
คนไข้จ่ายเงิน
    │
    ├─ ช่องทาง 1: อัพสลิปในแอป MedMatch โดยตรง
    ├─ ช่องทาง 2: อัพสลิปผ่าน Telegram Bot (เหมือนเดิม)
    └─ ช่องทาง 3: (อนาคต) จ่ายผ่าน QR PromptPay ในแอป
          │
          ▼
    AI Slip Verification (ระบบเดิมที่มี)
    ├── OCR อ่านข้อมูลสลิป (จำนวนเงิน, วันเวลา, บัญชีผู้รับ)
    ├── ตรวจสอบ match กับ booking (จำนวนเงินตรงไหม?)
    └── Auto-confirm ถ้าถูกต้อง / Flag ถ้าไม่ตรง
          │
          ▼
    บันทึกลง Accounting Database
    ├── รายรับประจำวัน
    ├── สรุปรายเดือน
    ├── แยกตามประเภทการรักษา
    └── Export รายงาน (PDF/Excel)
```

---

## 5. Key Screens (Wireframe Concept)

### หมอ (Seeker/Provider)

```
1. Onboarding → สมัคร → กรอก profile → verify ใบประกอบ
2. Home (Swipe View) → การ์ดงาน (ชื่อคลินิก, วัน, เวลา, ค่าตอบแทน, ระยะทาง)
   → Swipe ขวา "สนใจ" / ซ้าย "ข้าม"
3. Map View → ดูงานบนแผนที่ ปักหมุดเลือกพื้นที่
4. Calendar → ดูวันว่าง + งานที่รับแล้ว
5. Matches → รายการที่ match แล้ว + สถานะ (รอยืนยัน/ยืนยันแล้ว/เสร็จสิ้น)
6. Chat → แชทกับคลินิก
7. Profile → ข้อมูลตัวเอง + rating + ประวัติทำงาน
```

### คลินิก (Poster/Manager)

```
1. Onboarding → สมัคร → กรอก business profile → verify ใบอนุญาต
2. Dashboard → ภาพรวมงานที่เปิดอยู่ + จำนวนผู้สนใจ + นัดหมายวันนี้ + รายรับ
3. Post Job → ฟอร์มโพสต์งาน (template ได้)
4. Applicants → ดูรายชื่อผู้สนใจแต่ละงาน → Accept/Reject
5. Booking Management → ดู/จัดการนัดหมายคนไข้
6. Payment → สลิปรอตรวจ + ประวัติการชำระ
7. Accounting → รายงานรายรับ-รายจ่าย + export
8. Chat → แชทกับหมอ/คนไข้
9. History → ประวัติการจ้าง + review
```

### คนไข้ (Patient)

```
1. Onboarding → สมัคร → กรอกข้อมูลพื้นฐาน
2. Search → ค้นหาคลินิก/หมอ ตามพื้นที่ + สาขา + rating
3. Doctor/Clinic Profile → ดูรายละเอียด + รีวิว
4. Booking → เลือกวัน/เวลา → จอง → ชำระ
5. My Bookings → ดูนัดหมายที่จองไว้ + สถานะ
6. Payment → อัพสลิป + ดูประวัติการชำระ
7. Reviews → เขียนรีวิวหลังรับบริการ
```

---

## 6. Tech Stack

### Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                    Frontend                        │
│                                                    │
│  📱 React Native (Expo)                           │
│  ├── Patient UI (คนไข้)                           │
│  ├── Provider UI (หมอ)                            │
│  └── Clinic UI (คลินิก — รองรับ iPad)              │
│                                                    │
│  🌐 Next.js Web (Admin Panel / Landing Page)      │
└────────────────────┬─────────────────────────────┘
                     │ REST API + WebSocket
┌────────────────────┴─────────────────────────────┐
│                    Backend                         │
│                                                    │
│  🖥️ NestJS (Main API)                             │
│  ├── Auth Module (Firebase Auth — OTP)            │
│  ├── Job Matching Module                          │
│  ├── Booking Module                               │
│  ├── Chat Module (Socket.IO)                      │
│  ├── Payment Module                               │
│  └── Notification Module (FCM)                    │
│                                                    │
│  🐍 Python Service (AI — ระบบเดิมที่มี)            │
│  ├── Slip OCR / Verification                      │
│  └── (อนาคต) AI Recommendation                    │
│                                                    │
│  🤖 Telegram Bot (ช่องทางอัพสลิปเดิม)              │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────┴─────────────────────────────┐
│                  Database & Storage                │
│                                                    │
│  🗄️ PostgreSQL + PostGIS                          │
│  📦 DigitalOcean Spaces (รูป/สลิป)                │
│  ⚡ Redis (cache + session + real-time queue)      │
└──────────────────────────────────────────────────┘
```

### Stack Detail

| Component | Technology | เหตุผล |
|---|---|---|
| **Mobile App** | React Native (Expo) | เขียนครั้งเดียวได้ iOS + Android + iPad, ต่อยอดจาก React/Next.js ที่คุ้นเคย |
| **Web Admin** | Next.js | Admin panel + Landing page |
| **API Server** | NestJS (Node.js) | Structure ดีสำหรับ app ใหญ่, modular |
| **Database** | PostgreSQL + PostGIS | Geolocation query, mature ecosystem |
| **ORM** | Prisma | Type-safe, great DX |
| **Real-time** | Socket.IO | Chat + live notifications |
| **Auth** | Firebase Auth | OTP เบอร์โทรไทย |
| **File Storage** | DigitalOcean Spaces | รูป profile, ใบประกอบ, สลิป |
| **Push Notification** | Firebase Cloud Messaging (FCM) | Cross-platform push |
| **Cache** | Redis | Session, cache, real-time queue |
| **AI Service** | Python (ระบบเดิม) | Slip OCR, AI recommendation |
| **Hosting** | DigitalOcean | ใช้อยู่แล้ว |
| **CI/CD** | GitHub Actions | Automated deployment |
| **Monitoring** | Sentry + Grafana | Error tracking + metrics |

### App Structure (1 App, Role-based)

```
MedMatch App (1 app เดียว)
├── Login → เลือก role
│   ├── "ฉันเป็นคนไข้" → Patient UI
│   ├── "ฉันเป็นหมอ/เภสัชกร" → Provider UI
│   └── "ฉันเป็นคลินิก" → Clinic UI
│
│   * หมอสามารถ switch ระหว่าง Provider ↔ Patient ได้
│   * คลินิกเห็นทั้ง Job Posting + Clinic Management
```

### iPad Support

- React Native + Expo รองรับ iPad ได้เลย
- ใช้ responsive layout (คล้าย CSS media query)
- iPad แสดง UI แบบ split view (ซ้ายรายชื่อนัด, ขวารายละเอียด)
- เหมาะกับคลินิกที่ตั้ง iPad ไว้หน้าเคาน์เตอร์

---

## 7. Database Schema

### Core Tables

```sql
-- === Users & Auth ===

users
├── id (UUID), email, phone, password_hash
├── role (seeker/clinic/patient), is_active
├── created_at, updated_at

-- === Seeker/Provider Profile ===

seeker_profiles
├── user_id (FK), first_name, last_name
├── license_number, license_type (dentist/doctor/pharmacist/nurse/...)
├── license_verified (boolean), experience_years
├── specialties (JSON array, เช่น ["endo", "ortho", "prosth"])
├── profile_image_url, bio
├── rating_avg, rating_count

-- === Clinic Profile ===

clinic_profiles
├── user_id (FK), clinic_name, address
├── latitude, longitude
├── license_number, license_verified
├── images (JSON array), description, equipment_info
├── parking_info, benefits
├── rating_avg, rating_count

-- === Patient Profile ===

patients
├── user_id (FK), first_name, last_name, phone
├── date_of_birth, drug_allergies (TEXT)
├── medical_notes (TEXT, encrypted)

-- === Job Matching ===

jobs
├── id, clinic_id (FK), title, description
├── specialty_required, work_date, start_time, end_time
├── pay_amount, pay_negotiable (boolean)
├── latitude, longitude
├── slots (จำนวนคนที่ต้องการ), filled_slots
├── status (open/filled/expired/cancelled)
├── expires_at, created_at

applications
├── id, job_id (FK), seeker_id (FK)
├── status (pending/accepted/rejected/cancelled)
├── created_at

matches
├── id, job_id (FK), seeker_id (FK), clinic_id (FK)
├── status (confirmed/completed/cancelled/no_show)
├── final_pay_amount, created_at

-- === Booking ===

clinic_services
├── id, clinic_id (FK), name (เช่น "อุดฟัน")
├── duration_minutes, price, price_negotiable
├── description, is_active

clinic_schedules
├── id, clinic_id (FK), provider_id (FK)
├── day_of_week (0-6), start_time, end_time
├── slot_duration_minutes, buffer_minutes, is_active

bookings
├── id, clinic_id (FK), provider_id (FK), patient_id (FK)
├── service_id (FK), booking_date, start_time, end_time
├── status (pending/confirmed/completed/cancelled/no_show)
├── patient_notes, total_amount
├── payment_status (unpaid/deposit_paid/fully_paid)
├── created_at

-- === Payment & Accounting ===

payments
├── id, booking_id (FK), clinic_id (FK), patient_id (FK)
├── amount, payment_method (transfer/cash/promptpay)
├── slip_image_url
├── ai_verified (boolean)
├── ai_extracted_data (JSON)
│   → { amount: 2500, date: "2026-02-19", bank: "SCB", ref: "..." }
├── verified_by (ai/manual/admin)
├── match_status (matched/amount_mismatch/pending_review)
├── status (pending/verified/rejected)
├── created_at

accounting_summary
├── id, clinic_id (FK), date
├── total_revenue, total_bookings
├── cash_amount, transfer_amount
├── created_at

-- === Doctor Work History ===

work_history
├── id, provider_id (FK), clinic_id (FK)
├── start_date, end_date (null = ยังทำอยู่)
├── role, is_verified (คลินิกยืนยัน)

provider_certificates
├── id, provider_id (FK), name, issuer
├── issue_date, image_url, is_verified

-- === Communication ===

messages
├── id, match_id (FK) / booking_id (FK)
├── sender_id (FK), content, read_at, created_at

-- === Reviews ===

reviews
├── id, match_id (FK) / booking_id (FK)
├── reviewer_id (FK), reviewee_id (FK)
├── rating (1-5), comment, created_at
```

---

## 8. Monetization Strategy

### Phase 1 — สร้าง user base (เดือน 1–6): ฟรีทั้งหมด

### Phase 2 — เริ่มเก็บเงิน (เดือน 6–12)

| โมเดล | รายละเอียด | ราคาแนะนำ |
|---|---|---|
| **Commission per match** | Service fee ต่อ match สำเร็จ (จากคลินิก) | 3–5% หรือ flat 50–100 บาท/match |
| **Booking Platform Fee** | ค่า service fee ต่อ booking | ฟรี 50 booking แรก/เดือน, หลังจากนั้น 20-30 บาท/booking |
| **Boost / Priority Listing** | งานขึ้นบนสุด (เหมือน Tinder Boost) | 59–199 บาท/ครั้ง |
| **Seeker Premium** | เห็นงานก่อน 30 นาที + badge "Verified Pro" | 199 บาท/เดือน |

### Phase 3 — SaaS Subscription

| Plan | ราคา | ฟีเจอร์ |
|---|---|---|
| **Basic (ฟรี)** | 0 บาท | โพสต์งาน 3/เดือน + รับ booking 50/เดือน |
| **Pro** | 999 บาท/เดือน | โพสต์ไม่จำกัด + booking ไม่จำกัด + Slip verification AI + Accounting dashboard + Export รายงาน |
| **Enterprise** | 2,499 บาท/เดือน | ทุกอย่างใน Pro + Multi-branch management + API integration + Priority support |

### Phase 4 — Scale (ปีที่ 2+)

| โมเดล | รายละเอียด |
|---|---|
| **Escrow Payment** | ตัวกลางรับจ่ายเงิน (transaction fee 2–3%) |
| **Insurance** | ขายประกันความรับผิดชอบวิชาชีพ (ร่วมกับบริษัทประกัน) |
| **Staffing Service** | จัดหาบุคลากรประจำ (full-time placement fee) |
| **Data & Analytics** | ขาย market insight (ค่าตอบแทนเฉลี่ย, demand trends) |

### Revenue Projection (ปีแรก)

```
สมมุติปีแรกได้:
├── 200 คลินิกใช้งาน
│   ├── 50 คลินิก Pro (฿999 × 50 × 12) = ฿599,400/ปี
│   ├── 10 คลินิก Enterprise (฿2,499 × 10 × 12) = ฿299,880/ปี
│   └── 140 คลินิก Free tier
│
├── Job Matching: 500 match/เดือน × ฿75 avg = ฿450,000/ปี
├── Booking fee: 3,000 booking/เดือน × ฿25 avg = ฿900,000/ปี
├── Boost: 100 boost/เดือน × ฿100 avg = ฿120,000/ปี
│
└── Total Year 1 estimate: ~฿2.37M/ปี
```

---

## 9. Competitive Advantage

| เทียบกับ | Facebook/LINE Group | MedMatch |
|---|---|---|
| ข้อมูล real-time | ❌ โพสต์เก่าค้างไม่ลบ | ✅ Auto-expire + สถานะ live |
| Filter ตาม location | ❌ ต้อง scroll หาเอง | ✅ ปักหมุด + รัศมี |
| Verify ตัวตน | ❌ ใครก็โพสต์ได้ | ✅ ยืนยันใบประกอบวิชาชีพ |
| ระบบจัดการ | ❌ แชทปนกัน | ✅ Dashboard + Calendar |
| Review | ❌ ไม่มี | ✅ Rating ทั้ง 3 ฝ่าย |
| Booking คนไข้ | ❌ ไม่มี | ✅ จองนัด online |
| Payment verification | ❌ ไม่มี | ✅ AI ตรวจสลิปอัตโนมัติ |
| ระบบบัญชี | ❌ ไม่มี | ✅ รายงานรายรับ + export |

### Network Effect

```
ยิ่งมีหมอเยอะ → คนไข้ยิ่งอยากใช้
→ คลินิกยิ่งอยากอยู่ในระบบ → หมอยิ่งมีงาน → วนลูป 🔄
```

---

## 10. Development Roadmap

### Phase 1 — MVP: Job Matching (เดือน 1–3)

- [ ] Auth + OTP (Firebase Auth)
- [ ] Seeker & Clinic profiles
- [ ] Post job + browse/apply (list view)
- [ ] Location filter (จังหวัด/อำเภอ dropdown)
- [ ] Application system (กดสนใจ → คลินิก accept)
- [ ] Basic in-app chat
- [ ] Push notifications (FCM)
- [ ] Landing page (Next.js)

### Phase 2 — Patient Booking (เดือน 4–6)

- [ ] Patient registration
- [ ] Doctor public profile + work history
- [ ] Clinic service listing
- [ ] Booking calendar + slot management
- [ ] Booking flow (เลือก → จอง → ยืนยัน)
- [ ] Swipe UI (card view สำหรับ job matching)
- [ ] Map view + ปักหมุด + radius
- [ ] Review system (ทั้ง 3 ฝ่าย)
- [ ] License verification system

### Phase 3 — Payment & Accounting (เดือน 7–9)

- [ ] Slip upload ในแอป
- [ ] Integrate AI slip verification (Python service เดิม)
- [ ] Telegram Bot bridge
- [ ] Payment matching กับ booking
- [ ] Clinic accounting dashboard
- [ ] Daily/Monthly report + export
- [ ] Quick re-post template

### Phase 4 — Monetization & Scale (เดือน 10–12)

- [ ] Subscription system (Free/Pro/Enterprise)
- [ ] Boost feature
- [ ] Seeker Premium
- [ ] Multi-branch clinic management
- [ ] Advanced matching algorithm
- [ ] Analytics dashboard สำหรับคลินิก

### Phase 5 — Expansion (ปีที่ 2+)

- [ ] Escrow payment system
- [ ] AI job/clinic recommendation
- [ ] Staffing for full-time positions
- [ ] Expand สาขา (พยาบาล, ผู้ช่วยทันตแพทย์, นักกายภาพ)
- [ ] Market data & analytics product
- [ ] Insurance partnership

---

## 11. Legal & Compliance

- **ใบอนุญาตจัดหางาน** — ตรวจสอบกับกรมการจัดหางาน (พ.ร.บ.จัดหางานและคุ้มครองคนหางาน)
- **PDPA** — เก็บข้อมูลใบประกอบวิชาชีพ, ข้อมูลส่วนบุคคล, ข้อมูลสุขภาพ ต้องมี consent + privacy policy ชัดเจน
- **ข้อบังคับแพทยสภา/ทันตแพทยสภา** — ตรวจสอบข้อจำกัดการรับงาน part-time ผ่านแพลตฟอร์ม
- **ภาษี** — หากเป็นตัวกลางรับจ่ายเงิน พิจารณาเรื่อง withholding tax และ VAT
- **ข้อมูลทางการแพทย์** — ข้อมูลคนไข้ต้อง encrypt และจัดเก็บตามมาตรฐาน

---

## 12. Quick Reference — Tech Stack Summary

```
📱 Mobile App:      React Native (Expo) — iOS + Android + iPad
🌐 Web:            Next.js (Admin Panel + Landing Page)
🖥️ Backend:         NestJS (Node.js)
🗄️ Database:        PostgreSQL + PostGIS
🔄 Real-time:       Socket.IO
🔐 Auth:            Firebase Auth (OTP)
📦 Storage:         DigitalOcean Spaces
📨 Notification:    Firebase Cloud Messaging (FCM)
⚡ Cache:           Redis
🐍 AI Service:      Python (Slip OCR + Recommendation)
🤖 Bot:             Telegram Bot (Slip upload channel)
🚀 Deploy:          DigitalOcean
🔧 CI/CD:           GitHub Actions
📊 Monitoring:      Sentry + Grafana
```

---

*Last updated: February 19, 2026*
*Project: MedMatch — Super App สำหรับวงการทันตกรรม & การแพทย์*

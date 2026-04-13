// ---------------------------------------------------------------------------
// Specialty & License-Type constants for MedMatch
// ---------------------------------------------------------------------------

export type LicenseType =
  | 'DENTIST'
  | 'DOCTOR'
  | 'PHARMACIST'
  | 'NURSE'
  | 'DENTAL_ASSISTANT'
  | 'PHYSIOTHERAPIST'
  | 'OTHER';

export interface SubSpecialtyOption {
  value: string;
  labelTh: string;
  labelEn: string;
}

// ---------------------------------------------------------------------------
// 1. LICENSE_TYPE_LABELS — Thai display name for each profession
// ---------------------------------------------------------------------------

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  DENTIST: 'ทันตแพทย์',
  DOCTOR: 'แพทย์',
  PHARMACIST: 'เภสัชกร',
  NURSE: 'พยาบาล',
  DENTAL_ASSISTANT: 'ผู้ช่วยทันตแพทย์',
  PHYSIOTHERAPIST: 'นักกายภาพบำบัด',
  OTHER: 'อื่น ๆ',
};

// ---------------------------------------------------------------------------
// 2. SUB_SPECIALTIES — hierarchical sub-specialties per profession
// ---------------------------------------------------------------------------

export const SUB_SPECIALTIES: Record<LicenseType, SubSpecialtyOption[]> = {
  DENTIST: [
    { value: 'GP', labelTh: 'ทันตแพทย์ทั่วไป', labelEn: 'General Practice' },
    { value: 'ORTHODONTICS', labelTh: 'ทันตกรรมจัดฟัน', labelEn: 'Orthodontics' },
    { value: 'ENDODONTICS', labelTh: 'วิทยาเอ็นโดดอนต์', labelEn: 'Endodontics' },
    { value: 'PROSTHODONTICS', labelTh: 'ทันตกรรมประดิษฐ์', labelEn: 'Prosthodontics' },
    { value: 'PERIODONTICS', labelTh: 'ปริทันตวิทยา', labelEn: 'Periodontics' },
    { value: 'ORAL_MAXILLOFACIAL_SURGERY', labelTh: 'ศัลยศาสตร์ช่องปากและแม็กซิลโลเฟเชียล', labelEn: 'Oral & Maxillofacial Surgery' },
    { value: 'PEDIATRIC_DENTISTRY', labelTh: 'ทันตกรรมสำหรับเด็ก', labelEn: 'Pediatric Dentistry' },
    { value: 'ORAL_MEDICINE', labelTh: 'เวชศาสตร์ช่องปาก', labelEn: 'Oral Medicine' },
    { value: 'OPERATIVE_DENTISTRY', labelTh: 'ทันตกรรมหัตถการ', labelEn: 'Operative Dentistry' },
    { value: 'ORAL_PATHOLOGY', labelTh: 'พยาธิวิทยาช่องปากและแม็กซิลโลเฟเชียล', labelEn: 'Oral & Maxillofacial Pathology' },
    { value: 'ORAL_RADIOLOGY', labelTh: 'รังสีวิทยาช่องปากและแม็กซิลโลเฟเชียล', labelEn: 'Oral & Maxillofacial Radiology' },
    { value: 'DENTAL_PUBLIC_HEALTH', labelTh: 'ทันตสาธารณสุข', labelEn: 'Dental Public Health' },
    { value: 'IMPLANTOLOGY', labelTh: 'ทันตกรรมรากเทียม', labelEn: 'Implantology' },
  ],

  DOCTOR: [
    { value: 'GP', labelTh: 'แพทย์เวชปฏิบัติทั่วไป', labelEn: 'General Practice' },
    // อายุรศาสตร์ — Internal Medicine & sub-branches
    { value: 'INTERNAL_MEDICINE', labelTh: 'อายุรศาสตร์', labelEn: 'Internal Medicine' },
    { value: 'CARDIOLOGY', labelTh: 'อายุรศาสตร์โรคหัวใจ', labelEn: 'Cardiology' },
    { value: 'GASTROENTEROLOGY', labelTh: 'อายุรศาสตร์โรคระบบทางเดินอาหาร', labelEn: 'Gastroenterology' },
    { value: 'NEPHROLOGY', labelTh: 'อายุรศาสตร์โรคไต', labelEn: 'Nephrology' },
    { value: 'PULMONOLOGY', labelTh: 'อายุรศาสตร์โรคระบบทางเดินหายใจ', labelEn: 'Pulmonology' },
    { value: 'ENDOCRINOLOGY', labelTh: 'อายุรศาสตร์โรคต่อมไร้ท่อ', labelEn: 'Endocrinology' },
    { value: 'HEMATOLOGY', labelTh: 'อายุรศาสตร์โรคเลือด', labelEn: 'Hematology' },
    { value: 'RHEUMATOLOGY', labelTh: 'อายุรศาสตร์โรคข้อและรูมาติซั่ม', labelEn: 'Rheumatology' },
    { value: 'INFECTIOUS_DISEASE', labelTh: 'อายุรศาสตร์โรคติดเชื้อ', labelEn: 'Infectious Disease' },
    { value: 'ALLERGY_IMMUNOLOGY', labelTh: 'อายุรศาสตร์โรคภูมิแพ้และภูมิคุ้มกัน', labelEn: 'Allergy & Immunology' },
    { value: 'MEDICAL_ONCOLOGY', labelTh: 'อายุรศาสตร์มะเร็งวิทยา', labelEn: 'Medical Oncology' },
    { value: 'CRITICAL_CARE', labelTh: 'เวชบำบัดวิกฤต', labelEn: 'Critical Care Medicine' },
    { value: 'GERIATRIC_MEDICINE', labelTh: 'อายุรศาสตร์ผู้สูงอายุ', labelEn: 'Geriatric Medicine' },
    // ศัลยศาสตร์ — Surgery & sub-branches
    { value: 'SURGERY', labelTh: 'ศัลยศาสตร์ทั่วไป', labelEn: 'General Surgery' },
    { value: 'NEUROSURGERY', labelTh: 'ประสาทศัลยศาสตร์', labelEn: 'Neurosurgery' },
    { value: 'CARDIOTHORACIC_SURGERY', labelTh: 'ศัลยศาสตร์ทรวงอก', labelEn: 'Cardiothoracic Surgery' },
    { value: 'PLASTIC_SURGERY', labelTh: 'ศัลยศาสตร์ตกแต่ง', labelEn: 'Plastic Surgery' },
    { value: 'UROLOGY', labelTh: 'ศัลยศาสตร์ระบบทางเดินปัสสาวะ', labelEn: 'Urology' },
    { value: 'VASCULAR_SURGERY', labelTh: 'ศัลยศาสตร์หลอดเลือด', labelEn: 'Vascular Surgery' },
    { value: 'PEDIATRIC_SURGERY', labelTh: 'กุมารศัลยศาสตร์', labelEn: 'Pediatric Surgery' },
    { value: 'COLORECTAL_SURGERY', labelTh: 'ศัลยศาสตร์ลำไส้ใหญ่และทวารหนัก', labelEn: 'Colorectal Surgery' },
    // Other major specialties
    { value: 'ORTHOPEDICS', labelTh: 'ออร์โธปิดิกส์', labelEn: 'Orthopedics' },
    { value: 'PEDIATRICS', labelTh: 'กุมารเวชศาสตร์', labelEn: 'Pediatrics' },
    { value: 'OBSTETRICS_GYNECOLOGY', labelTh: 'สูติศาสตร์-นรีเวชวิทยา', labelEn: 'Obstetrics & Gynecology' },
    { value: 'OPHTHALMOLOGY', labelTh: 'จักษุวิทยา', labelEn: 'Ophthalmology' },
    { value: 'ENT', labelTh: 'โสต ศอ นาสิกวิทยา', labelEn: 'ENT (Otolaryngology)' },
    { value: 'DERMATOLOGY', labelTh: 'ตจวิทยา (ผิวหนัง)', labelEn: 'Dermatology' },
    { value: 'PSYCHIATRY', labelTh: 'จิตเวชศาสตร์', labelEn: 'Psychiatry' },
    { value: 'NEUROLOGY', labelTh: 'ประสาทวิทยา', labelEn: 'Neurology' },
    { value: 'ANESTHESIOLOGY', labelTh: 'วิสัญญีวิทยา', labelEn: 'Anesthesiology' },
    { value: 'RADIOLOGY', labelTh: 'รังสีวิทยาวินิจฉัย', labelEn: 'Diagnostic Radiology' },
    { value: 'RADIATION_ONCOLOGY', labelTh: 'รังสีรักษาและมะเร็งวิทยา', labelEn: 'Radiation Oncology' },
    { value: 'NUCLEAR_MEDICINE', labelTh: 'เวชศาสตร์นิวเคลียร์', labelEn: 'Nuclear Medicine' },
    { value: 'PATHOLOGY', labelTh: 'พยาธิวิทยากายวิภาค', labelEn: 'Anatomical Pathology' },
    { value: 'CLINICAL_PATHOLOGY', labelTh: 'พยาธิวิทยาคลินิก', labelEn: 'Clinical Pathology' },
    { value: 'FORENSIC_MEDICINE', labelTh: 'นิติเวชศาสตร์', labelEn: 'Forensic Medicine' },
    // เวชศาสตร์ — Community/preventive
    { value: 'EMERGENCY_MEDICINE', labelTh: 'เวชศาสตร์ฉุกเฉิน', labelEn: 'Emergency Medicine' },
    { value: 'FAMILY_MEDICINE', labelTh: 'เวชศาสตร์ครอบครัว', labelEn: 'Family Medicine' },
    { value: 'REHABILITATION_MEDICINE', labelTh: 'เวชศาสตร์ฟื้นฟู', labelEn: 'Rehabilitation Medicine' },
    { value: 'PREVENTIVE_MEDICINE', labelTh: 'เวชศาสตร์ป้องกัน', labelEn: 'Preventive Medicine' },
    { value: 'OCCUPATIONAL_MEDICINE', labelTh: 'อาชีวเวชศาสตร์', labelEn: 'Occupational Medicine' },
    { value: 'AEROSPACE_MEDICINE', labelTh: 'เวชศาสตร์การบิน', labelEn: 'Aerospace Medicine' },
  ],

  PHARMACIST: [
    { value: 'CLINICAL_PHARMACY', labelTh: 'เภสัชกรรมคลินิก', labelEn: 'Clinical Pharmacy' },
    { value: 'COMMUNITY_PHARMACY', labelTh: 'เภสัชกรรมชุมชน (ร้านยา)', labelEn: 'Community Pharmacy' },
    { value: 'HOSPITAL_PHARMACY', labelTh: 'เภสัชกรรมโรงพยาบาล', labelEn: 'Hospital Pharmacy' },
    { value: 'INDUSTRIAL_PHARMACY', labelTh: 'เภสัชกรรมอุตสาหกรรม', labelEn: 'Industrial Pharmacy' },
    { value: 'PHARMACEUTICAL_CARE', labelTh: 'การบริบาลทางเภสัชกรรม', labelEn: 'Pharmaceutical Care' },
  ],

  NURSE: [
    { value: 'GENERAL_NURSING', labelTh: 'พยาบาลทั่วไป', labelEn: 'General Nursing' },
    { value: 'ICU_CRITICAL_CARE', labelTh: 'พยาบาลวิกฤต', labelEn: 'ICU / Critical Care' },
    { value: 'OR_NURSE', labelTh: 'พยาบาลห้องผ่าตัด', labelEn: 'OR Nurse' },
    { value: 'ER_NURSE', labelTh: 'พยาบาลฉุกเฉิน', labelEn: 'ER Nurse' },
    { value: 'PEDIATRIC_NURSE', labelTh: 'พยาบาลเด็ก', labelEn: 'Pediatric Nurse' },
    { value: 'DENTAL_NURSE', labelTh: 'พยาบาลทันตกรรม', labelEn: 'Dental Nurse' },
    { value: 'OB_GYN_NURSE', labelTh: 'พยาบาลสูติ-นรีเวช', labelEn: 'OB-GYN Nurse' },
    { value: 'COMMUNITY_NURSE', labelTh: 'พยาบาลชุมชน', labelEn: 'Community Health Nurse' },
    { value: 'ANESTHESIA_NURSE', labelTh: 'พยาบาลวิสัญญี', labelEn: 'Anesthesia Nurse' },
  ],

  DENTAL_ASSISTANT: [
    { value: 'GENERAL', labelTh: 'ผู้ช่วยทันตแพทย์ทั่วไป', labelEn: 'General' },
    { value: 'ORTHODONTIC_ASSISTANT', labelTh: 'ผู้ช่วยทันตแพทย์จัดฟัน', labelEn: 'Orthodontic Assistant' },
    { value: 'SURGICAL_ASSISTANT', labelTh: 'ผู้ช่วยศัลยกรรมช่องปาก', labelEn: 'Surgical Assistant' },
    { value: 'PROSTHODONTIC_ASSISTANT', labelTh: 'ผู้ช่วยทันตกรรมประดิษฐ์', labelEn: 'Prosthodontic Assistant' },
  ],

  PHYSIOTHERAPIST: [
    { value: 'MUSCULOSKELETAL', labelTh: 'กายภาพบำบัดระบบกระดูกและกล้ามเนื้อ', labelEn: 'Musculoskeletal' },
    { value: 'NEUROLOGICAL', labelTh: 'กายภาพบำบัดระบบประสาท', labelEn: 'Neurological' },
    { value: 'CARDIOPULMONARY', labelTh: 'กายภาพบำบัดระบบหัวใจและปอด', labelEn: 'Cardiopulmonary' },
    { value: 'SPORTS', labelTh: 'กายภาพบำบัดการกีฬา', labelEn: 'Sports' },
    { value: 'PEDIATRIC_PT', labelTh: 'กายภาพบำบัดเด็ก', labelEn: 'Pediatric Physiotherapy' },
    { value: 'GERIATRIC_PT', labelTh: 'กายภาพบำบัดผู้สูงอายุ', labelEn: 'Geriatric Physiotherapy' },
  ],

  OTHER: [],
};

// ---------------------------------------------------------------------------
// 3. EXTRA_SKILLS — common certifications / skills per profession
// ---------------------------------------------------------------------------

export const EXTRA_SKILLS: Record<LicenseType, string[]> = {
  DENTIST: [
    'Invisalign',
    'Zoom Whitening',
    'Digital Smile Design',
    'CAD/CAM (CEREC)',
    'Laser Dentistry',
    'Dental Photography',
    'Microscope Dentistry',
    'Conscious Sedation',
    'CBCT Interpretation',
    'Veneer & Laminate',
  ],

  DOCTOR: [
    'ACLS',
    'ATLS',
    'BLS',
    'PALS',
    'Ultrasound',
    'Laparoscopic Surgery',
    'Botox / Filler',
    'Laser Treatment',
    'Point-of-Care Ultrasound (POCUS)',
    'Telemedicine',
  ],

  PHARMACIST: [
    'Chemotherapy Preparation',
    'TPN Compounding',
    'Medication Reconciliation',
    'Anticoagulation Management',
    'Pharmacokinetics Dosing',
    'Herbal & Supplement Counseling',
    'Vaccination Administration',
  ],

  NURSE: [
    'BLS',
    'ACLS',
    'IV Therapy',
    'Ventilator Management',
    'Wound Care',
    'Chemotherapy Administration',
    'Neonatal Resuscitation (NRP)',
    'Triage',
    'Patient Education',
  ],

  DENTAL_ASSISTANT: [
    'Dental X-ray',
    'Infection Control',
    'Impression Taking',
    'Chairside Assisting',
    'Sterilization',
    'Dental Materials Handling',
  ],

  PHYSIOTHERAPIST: [
    'Manual Therapy',
    'Dry Needling',
    'Therapeutic Ultrasound',
    'Kinesio Taping',
    'Hydrotherapy',
    'Electrotherapy',
    'Ergonomic Assessment',
    'Sports Massage',
  ],

  OTHER: [],
};

// ---------------------------------------------------------------------------
// 4. Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns the Thai label for a single sub-specialty value within a profession.
 * Falls back to the raw value if not found.
 */
export function getSubSpecialtyLabel(
  licenseType: string,
  subSpecialty: string,
): string {
  const options = SUB_SPECIALTIES[licenseType as LicenseType];
  if (!options) return subSpecialty;
  const match = options.find((o) => o.value === subSpecialty);
  return match ? match.labelTh : subSpecialty;
}

/**
 * Returns a comma-separated string of Thai labels for multiple sub-specialties.
 */
export function getSubSpecialtyLabels(
  licenseType: string,
  subSpecialties: string[],
): string {
  return subSpecialties
    .map((s) => getSubSpecialtyLabel(licenseType, s))
    .join(', ');
}

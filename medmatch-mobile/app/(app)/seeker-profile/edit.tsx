import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, CheckCircle, Circle, Search, X } from 'lucide-react-native';
import { Button } from '../../../src/components/common/Button';
import { Input } from '../../../src/components/common/Input';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, uploadFile, resolveImageUrl } from '../../../src/services/api';
import { LICENSE_TYPE_LABELS, SUB_SPECIALTIES, EXTRA_SKILLS as EXTRA_SKILLS_MAP, LicenseType } from '../../../src/constants/specialties';

const SPECIALTIES = Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function SeekerProfileEditScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [subSpecialtySearch, setSubSpecialtySearch] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: '',
        specialty: '',
        sub_specialties: [] as string[],
        license_number: '',
        years_experience: '',
        bio: '',
        skills: [] as string[],
        line_id: '',
        phone: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/profile/seeker/me?reveal=true');
            const p = res.data;
            setForm({
                full_name: p.full_name || '',
                specialty: p.specialty || '',
                sub_specialties: p.sub_specialties || [],
                license_number: p.license_number || '',
                years_experience: String(p.years_experience ?? ''),
                bio: p.bio || '',
                skills: p.skills || [],
                line_id: p.line_id || '',
                phone: p.phone || '',
            });
            if (p.profile_image_url) setProfileImage(p.profile_image_url);
        } catch {
            // New profile — form stays empty
        } finally {
            setIsLoading(false);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (!result.canceled) setProfileImage(result.assets[0].uri);
    };

    const handleSpecialtyChange = (value: string) => {
        setForm((f) => ({
            ...f,
            specialty: value,
            sub_specialties: [],
            skills: [],
        }));
        setSubSpecialtySearch('');
    };

    const toggleSubSpecialty = (value: string) => {
        setForm((f) => ({
            ...f,
            sub_specialties: f.sub_specialties.includes(value)
                ? f.sub_specialties.filter((s) => s !== value)
                : [...f.sub_specialties, value],
        }));
    };

    const toggleSkill = (skill: string) => {
        setForm((f) => ({
            ...f,
            skills: f.skills.includes(skill)
                ? f.skills.filter((s) => s !== skill)
                : [...f.skills, skill],
        }));
    };

    const availableSubSpecialties = form.specialty
        ? SUB_SPECIALTIES[form.specialty as LicenseType] || []
        : [];

    const filteredSubSpecialties = subSpecialtySearch.trim()
        ? availableSubSpecialties.filter(
            (s) =>
                s.labelTh.toLowerCase().includes(subSpecialtySearch.toLowerCase()) ||
                s.labelEn.toLowerCase().includes(subSpecialtySearch.toLowerCase()),
          )
        : availableSubSpecialties;

    const availableSkills = form.specialty
        ? EXTRA_SKILLS_MAP[form.specialty as LicenseType] || []
        : [];

    const handleSave = async () => {
        if (!form.full_name.trim()) {
            Alert.alert('Required', 'Please enter your full name.');
            return;
        }
        if (!form.specialty) {
            Alert.alert('Required', 'Please select your specialty.');
            return;
        }
        setIsSaving(true);
        try {
            const payload: any = {
                ...form,
                years_experience: form.years_experience ? Number(form.years_experience) : undefined,
                sub_specialties: form.sub_specialties,
            };

            // Upload profile image first if changed (skip if it's already an uploaded path)
            if (profileImage && !profileImage.startsWith('http') && !profileImage.startsWith('/uploads')) {
                const imgRes = await uploadFile('/profile/upload-image?folder=profiles', profileImage);
                payload.profile_image_url = imgRes.url;
            }

            await api.put('/profile/seeker', payload);
            Alert.alert('Saved!', 'Your profile has been updated.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to save profile.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary.DEFAULT} /></View>;
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
                        {profileImage ? (
                            <Image source={{ uri: resolveImageUrl(profileImage) }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Camera size={28} color={colors.text.disabled} />
                            </View>
                        )}
                        <View style={styles.cameraOverlay}>
                            <Camera size={16} color={colors.text.inverse} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.avatarHint}>Tap to change photo</Text>
                </View>

                {/* Basic Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Basic Info</Text>
                    <Input
                        label="Full Name *"
                        placeholder="Dr. Somchai Thawan"
                        value={form.full_name}
                        onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
                    />
                    <Input
                        label="Phone Number"
                        placeholder="08X-XXX-XXXX"
                        keyboardType="phone-pad"
                        value={form.phone}
                        onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                    />
                    <Input
                        label="LINE ID"
                        placeholder="Your LINE ID"
                        value={form.line_id}
                        onChangeText={(v) => setForm((f) => ({ ...f, line_id: v }))}
                    />
                </View>

                {/* Step 1: Profession Type */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ประเภทวิชาชีพ *</Text>
                    <Text style={styles.sectionHint}>เลือกประเภทใบอนุญาตของคุณ</Text>
                    <View style={styles.optionsGrid}>
                        {SPECIALTIES.map((s) => (
                            <TouchableOpacity
                                key={s.value}
                                style={[styles.optionChip, form.specialty === s.value && styles.optionChipSelected]}
                                onPress={() => handleSpecialtyChange(s.value)}
                            >
                                {form.specialty === s.value
                                    ? <CheckCircle size={14} color={colors.primary.DEFAULT} />
                                    : <Circle size={14} color={colors.border.DEFAULT} />
                                }
                                <Text style={[styles.optionText, form.specialty === s.value && styles.optionTextSelected]}>
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Step 2: Sub-specialties */}
                {!!form.specialty && availableSubSpecialties.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.subHeaderRow}>
                            <Text style={styles.sectionTitle}>สาขาเฉพาะทาง</Text>
                            {form.sub_specialties.length > 0 && (
                                <View style={styles.selectedBadge}>
                                    <Text style={styles.selectedBadgeText}>
                                        {form.sub_specialties.length} เลือกแล้ว
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.sectionHint}>เลือกได้มากกว่า 1 สาขา</Text>

                        {/* Search bar */}
                        <View style={styles.searchBar}>
                            <Search size={16} color={colors.text.disabled} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="ค้นหาสาขา..."
                                placeholderTextColor={colors.text.disabled}
                                value={subSpecialtySearch}
                                onChangeText={setSubSpecialtySearch}
                                returnKeyType="search"
                            />
                            {!!subSpecialtySearch && (
                                <TouchableOpacity onPress={() => setSubSpecialtySearch('')}>
                                    <X size={16} color={colors.text.disabled} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {filteredSubSpecialties.length === 0 ? (
                            <Text style={styles.emptySearch}>ไม่พบสาขาที่ค้นหา</Text>
                        ) : (
                        <View style={styles.optionsGrid}>
                            {filteredSubSpecialties.map((sub) => {
                                const isSelected = form.sub_specialties.includes(sub.value);
                                return (
                                    <TouchableOpacity
                                        key={sub.value}
                                        style={[styles.subChip, isSelected && styles.subChipSelected]}
                                        onPress={() => toggleSubSpecialty(sub.value)}
                                    >
                                        {isSelected
                                            ? <CheckCircle size={14} color={colors.secondary.DEFAULT} />
                                            : <Circle size={14} color={colors.border.DEFAULT} />
                                        }
                                        <View style={styles.subChipTextWrap}>
                                            <Text style={[styles.subChipTextTh, isSelected && styles.subChipTextSelected]}>
                                                {sub.labelTh}
                                            </Text>
                                            <Text style={styles.subChipTextEn}>{sub.labelEn}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        )}
                    </View>
                )}

                {/* Professional */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Professional Details</Text>
                    <Input
                        label="License Number"
                        placeholder="ท.00000 / พ.00000"
                        value={form.license_number}
                        onChangeText={(v) => setForm((f) => ({ ...f, license_number: v }))}
                    />
                    <Input
                        label="Years of Experience"
                        placeholder="e.g. 3"
                        keyboardType="numeric"
                        value={form.years_experience}
                        onChangeText={(v) => setForm((f) => ({ ...f, years_experience: v }))}
                    />
                    <Input
                        label="Bio / Introduction"
                        placeholder="Tell clinics about yourself..."
                        value={form.bio}
                        onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                {/* Extra Skills */}
                {!!form.specialty && availableSkills.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ทักษะพิเศษ</Text>
                    <Text style={styles.sectionHint}>เลือกทักษะที่คุณมีความเชี่ยวชาญ</Text>
                    <View style={styles.skillsWrap}>
                        {availableSkills.map((skill) => (
                            <TouchableOpacity
                                key={skill}
                                style={[styles.skillTag, form.skills.includes(skill) && styles.skillTagSelected]}
                                onPress={() => toggleSkill(skill)}
                            >
                                <Text style={[styles.skillTagText, form.skills.includes(skill) && styles.skillTagTextSelected]}>
                                    {skill}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                )}

                <Button title="Save Profile" onPress={handleSave} isLoading={isSaving} style={styles.saveBtn} />
                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { padding: spacing.md },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    cameraOverlay: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: colors.primary.DEFAULT, borderRadius: 14,
        width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.background.paper,
    },
    avatarHint: { fontSize: 12, color: colors.text.disabled, marginTop: spacing.sm },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 13, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    optionChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.sm, paddingVertical: 6,
        backgroundColor: colors.background.DEFAULT,
    },
    optionChipSelected: {
        borderColor: colors.primary.DEFAULT, backgroundColor: colors.primary.transparent,
    },
    optionText: { fontSize: 13, color: colors.text.secondary },
    optionTextSelected: { color: colors.primary.DEFAULT, fontWeight: '600' },
    sectionHint: { fontSize: 12, color: colors.text.disabled, marginBottom: spacing.md },
    subHeaderRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
    },
    selectedBadge: {
        backgroundColor: colors.secondary.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.sm, paddingVertical: 2,
    },
    selectedBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.md,
        paddingHorizontal: spacing.sm, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        backgroundColor: colors.background.DEFAULT, marginBottom: spacing.md,
    },
    searchInput: {
        flex: 1, fontSize: 14, color: colors.text.primary,
        padding: 0,
    },
    emptySearch: {
        fontSize: 13, color: colors.text.disabled, textAlign: 'center',
        paddingVertical: spacing.md,
    },
    subChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%',
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.lg,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
        backgroundColor: colors.background.DEFAULT,
    },
    subChipSelected: {
        borderColor: colors.secondary.DEFAULT, backgroundColor: 'rgba(16,185,129,0.08)',
    },
    subChipTextWrap: { flex: 1 },
    subChipTextTh: { fontSize: 13, color: colors.text.secondary },
    subChipTextSelected: { color: colors.secondary.DEFAULT, fontWeight: '600' },
    subChipTextEn: { fontSize: 11, color: colors.text.disabled },
    skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    skillTag: {
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.background.DEFAULT,
    },
    skillTagSelected: { borderColor: colors.secondary.DEFAULT, backgroundColor: 'rgba(16,185,129,0.1)' },
    skillTagText: { fontSize: 13, color: colors.text.secondary },
    skillTagTextSelected: { color: colors.secondary.DEFAULT, fontWeight: '600' },
    saveBtn: { marginTop: spacing.sm },
});

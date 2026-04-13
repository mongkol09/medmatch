import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Calendar, Clock, DollarSign, Users } from 'lucide-react-native';
import { Button } from '../../../src/components/common/Button';
import { Input } from '../../../src/components/common/Input';
import { DatePickerField } from '../../../src/components/common/DatePickerField';
import { TimePickerField } from '../../../src/components/common/TimePickerField';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api } from '../../../src/services/api';
import { LICENSE_TYPE_LABELS, SUB_SPECIALTIES, LicenseType } from '../../../src/constants/specialties';

const SPECIALTIES = Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function PostJobScreen() {
    const router = useRouter();
    const [isPosting, setIsPosting] = useState(false);
    const [form, setForm] = useState({
        title: '',
        specialty_required: '',
        work_date: '',
        start_time: '',
        end_time: '',
        pay_amount: '',
        is_negotiable: false,
        slots_needed: '1',
        requirements: '',
        benefits: '',
        sub_specialties: [] as string[],
    });

    const update = (key: keyof typeof form, value: any) =>
        setForm((f) => ({
            ...f,
            [key]: value,
            ...(key === 'specialty_required' ? { sub_specialties: [] } : {}),
        }));

    const toggleSubSpecialty = (val: string) => {
        setForm((f) => ({
            ...f,
            sub_specialties: f.sub_specialties.includes(val)
                ? f.sub_specialties.filter((v) => v !== val)
                : [...f.sub_specialties, val],
        }));
    };

    const availableSubSpecialties = form.specialty_required
        ? SUB_SPECIALTIES[form.specialty_required as LicenseType] || []
        : [];

    const handlePost = async () => {
        if (!form.title.trim()) { Alert.alert('Required', 'Enter a job title.'); return; }
        if (!form.specialty_required) { Alert.alert('Required', 'Select the specialty needed.'); return; }
        if (!form.work_date) { Alert.alert('Required', 'Select a work date.'); return; }
        if (!form.start_time) { Alert.alert('Required', 'Select a start time.'); return; }
        if (!form.end_time) { Alert.alert('Required', 'Select an end time.'); return; }

        setIsPosting(true);
        try {
            await api.post('/jobs', {
                title: form.title,
                specialtyRequired: form.specialty_required,
                subSpecialtiesRequired: form.sub_specialties.length > 0 ? form.sub_specialties : undefined,
                workDate: form.work_date,
                startTime: form.start_time,
                endTime: form.end_time,
                payAmount: form.pay_amount ? Number(form.pay_amount) : undefined,
                payNegotiable: form.is_negotiable,
                slots: Number(form.slots_needed) || 1,
                description: [form.requirements, form.benefits].filter(Boolean).join('\n') || undefined,
            });
            Alert.alert('Posted!', 'Your job has been published. Applicants will start appearing soon.', [
                { text: 'View My Jobs', onPress: () => router.replace('/(app)/jobs/my-jobs' as any) },
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : (msg || 'Failed to post job.'));
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post a Job</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Basic */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Job Details</Text>
                    <Input
                        label="Job Title *"
                        placeholder="e.g. ทันตแพทย์ GP เสาร์-อาทิตย์"
                        value={form.title}
                        onChangeText={(v) => update('title', v)}
                    />

                    <Text style={styles.fieldLabel}>Specialty Required *</Text>
                    <View style={styles.specialtyGrid}>
                        {SPECIALTIES.map((s) => (
                            <TouchableOpacity
                                key={s.value}
                                style={[
                                    styles.specialtyChip,
                                    form.specialty_required === s.value && styles.specialtyChipSelected,
                                ]}
                                onPress={() => update('specialty_required', s.value)}
                            >
                                <Text style={[
                                    styles.specialtyText,
                                    form.specialty_required === s.value && styles.specialtyTextSelected,
                                ]}>
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Sub-specialties */}
                {availableSubSpecialties.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>สาขาเฉพาะทางที่ต้องการ</Text>
                    <Text style={styles.subHint}>เลือกได้มากกว่า 1 สาขา (ถ้าไม่เลือก = รับทุกสาขา)</Text>
                    <View style={styles.subGrid}>
                        {availableSubSpecialties.map((sub) => {
                            const isSelected = form.sub_specialties.includes(sub.value);
                            return (
                                <TouchableOpacity
                                    key={sub.value}
                                    style={[styles.subChip, isSelected && styles.subChipSelected]}
                                    onPress={() => toggleSubSpecialty(sub.value)}
                                >
                                    <View style={styles.subChipContent}>
                                        <Text style={[styles.subChipTh, isSelected && styles.subChipThActive]}>
                                            {sub.labelTh}
                                        </Text>
                                        <Text style={styles.subChipEn}>{sub.labelEn}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
                )}

                {/* Schedule */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Schedule</Text>
                    <DatePickerField
                        label="Work Date *"
                        value={form.work_date}
                        onChange={(v) => update('work_date', v)}
                        placeholder="Select work date"
                        minDate={new Date().toISOString().split('T')[0]}
                    />
                    <View style={styles.timeRow}>
                        <View style={{ flex: 1 }}>
                            <TimePickerField
                                label="Start Time *"
                                value={form.start_time}
                                onChange={(v) => update('start_time', v)}
                                placeholder="Start"
                            />
                        </View>
                        <Text style={styles.timeSep}>—</Text>
                        <View style={{ flex: 1 }}>
                            <TimePickerField
                                label="End Time *"
                                value={form.end_time}
                                onChange={(v) => update('end_time', v)}
                                placeholder="End"
                            />
                        </View>
                    </View>
                </View>

                {/* Pay */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Compensation</Text>
                    <Input
                        label="Pay Amount (฿/day)"
                        placeholder={form.is_negotiable ? 'Negotiable' : 'e.g. 5000'}
                        value={form.pay_amount}
                        onChangeText={(v) => update('pay_amount', v)}
                        leftIcon={<DollarSign size={18} color={colors.text.disabled} />}
                        keyboardType="numeric"
                        editable={!form.is_negotiable}
                    />
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Negotiable</Text>
                        <Switch
                            value={form.is_negotiable}
                            onValueChange={(v) => {
                                update('is_negotiable', v);
                                if (v) update('pay_amount', '');
                            }}
                            trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                            thumbColor={colors.background.paper}
                        />
                    </View>
                </View>

                {/* Staffing */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Staffing</Text>
                    <Input
                        label="Number of Staff Needed"
                        placeholder="1"
                        keyboardType="numeric"
                        value={form.slots_needed}
                        onChangeText={(v) => update('slots_needed', v)}
                        leftIcon={<Users size={18} color={colors.text.disabled} />}
                    />
                </View>

                {/* Extra Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Additional Info</Text>
                    <Input
                        label="Requirements"
                        placeholder="e.g. Must have endo experience, own instruments preferred..."
                        value={form.requirements}
                        onChangeText={(v) => update('requirements', v)}
                        multiline numberOfLines={3}
                    />
                    <Input
                        label="Benefits"
                        placeholder="e.g. Lunch provided, parking, lab fee covered..."
                        value={form.benefits}
                        onChangeText={(v) => update('benefits', v)}
                        multiline numberOfLines={3}
                    />
                </View>

                {/* Preview */}
                <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>Job Preview</Text>
                    <Text style={styles.previewTitle}>{form.title || 'Job Title'}</Text>
                    <Text style={styles.previewDetail}>
                        📅 {form.work_date || 'Date TBD'}  ·  🕘 {form.start_time || '??:??'}–{form.end_time || '??:??'}
                    </Text>
                    <Text style={styles.previewDetail}>
                        💰 {form.is_negotiable ? 'Negotiable' : form.pay_amount ? `฿${Number(form.pay_amount).toLocaleString()}` : 'TBD'}
                    </Text>
                </View>

                <Button title="Post Job" onPress={handlePost} isLoading={isPosting} style={styles.postBtn} />
                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { padding: spacing.md },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.sm },
    specialtyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    specialtyChip: {
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.background.DEFAULT,
    },
    specialtyChipSelected: { borderColor: colors.primary.DEFAULT, backgroundColor: colors.primary.transparent },
    specialtyText: { fontSize: 12, color: colors.text.secondary },
    specialtyTextSelected: { color: colors.primary.DEFAULT, fontWeight: '600' },
    subHint: { fontSize: 12, color: colors.text.disabled, marginBottom: spacing.md },
    subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    subChip: {
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.lg,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
        backgroundColor: colors.background.DEFAULT,
    },
    subChipSelected: { borderColor: colors.secondary.DEFAULT, backgroundColor: 'rgba(16,185,129,0.08)' },
    subChipContent: { },
    subChipTh: { fontSize: 12, color: colors.text.secondary },
    subChipThActive: { color: colors.secondary.DEFAULT, fontWeight: '600' },
    subChipEn: { fontSize: 10, color: colors.text.disabled, marginTop: 1 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    timeSep: { fontSize: 18, color: colors.text.disabled, marginTop: 20 },
    switchRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    switchLabel: { fontSize: 15, color: colors.text.primary },
    previewCard: {
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.lg,
        padding: spacing.lg, marginBottom: spacing.md,
        borderWidth: 1, borderColor: colors.primary.DEFAULT + '50',
    },
    previewLabel: { fontSize: 11, fontWeight: '700', color: colors.primary.DEFAULT, textTransform: 'uppercase', marginBottom: spacing.sm },
    previewTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.xs },
    previewDetail: { fontSize: 14, color: colors.text.secondary, marginBottom: 4 },
    postBtn: { marginTop: spacing.sm },
});

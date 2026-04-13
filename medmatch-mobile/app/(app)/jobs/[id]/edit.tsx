import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '../../../../src/components/common/Button';
import { DatePickerField } from '../../../../src/components/common/DatePickerField';
import { TimePickerField } from '../../../../src/components/common/TimePickerField';
import { colors, spacing, borderRadii, shadows } from '../../../../src/theme';
import { api } from '../../../../src/services/api';

const SPECIALTIES = [
    { value: 'DENTIST', label: 'ทันตแพทย์' },
    { value: 'DOCTOR', label: 'แพทย์ทั่วไป' },
    { value: 'PHARMACIST', label: 'เภสัชกร' },
    { value: 'NURSE', label: 'พยาบาล' },
    { value: 'DENTAL_ASSISTANT', label: 'ผู้ช่วยทันตแพทย์' },
    { value: 'PHYSIOTHERAPIST', label: 'นักกายภาพบำบัด' },
    { value: 'OTHER', label: 'อื่นๆ' },
];

export default function EditJobScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [title, setTitle] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [workDate, setWorkDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const [isNegotiable, setIsNegotiable] = useState(false);
    const [slotsNeeded, setSlotsNeeded] = useState('1');
    const [requirements, setRequirements] = useState('');
    const [benefits, setBenefits] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/jobs/${id}`);
                const job = res.data;
                setTitle(job.title || '');
                setSpecialty(job.specialty_required || '');
                setWorkDate(job.work_date?.split('T')[0] || '');
                setStartTime(job.start_time || '');
                setEndTime(job.end_time || '');
                setPayAmount(job.pay_amount ? String(job.pay_amount) : '');
                setIsNegotiable(job.pay_negotiable || false);
                setSlotsNeeded(job.slots ? String(job.slots) : '1');
                setRequirements(job.requirements || '');
                setBenefits(job.benefits || '');
            } catch {
                Alert.alert('Error', 'Could not load job details.', [
                    { text: 'Go Back', onPress: () => router.back() },
                ]);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id]);

    const handleSave = async () => {
        if (!title.trim()) { Alert.alert('Required', 'Job title is required.'); return; }
        setIsSaving(true);
        try {
            await api.put(`/jobs/${id}`, {
                title: title.trim(),
                specialtyRequired: specialty,
                workDate,
                startTime,
                endTime,
                payAmount: payAmount ? Number(payAmount) : undefined,
                isNegotiable,
                slotsNeeded: Number(slotsNeeded) || 1,
                requirements,
                benefits,
            });
            Alert.alert('Saved!', 'Job has been updated.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (e: any) {
            Alert.alert('Failed', e.response?.data?.message || 'Could not update job.');
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
                <Text style={styles.headerTitle}>Edit Job</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={styles.label}>Job Title *</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle}
                    placeholder="e.g. ทันตแพทย์ประจำคลินิก" placeholderTextColor={colors.text.disabled} />

                <Text style={styles.label}>Specialty Required *</Text>
                <View style={styles.chipsRow}>
                    {SPECIALTIES.map(s => (
                        <TouchableOpacity
                            key={s.value}
                            style={[styles.chip, specialty === s.value && styles.chipActive]}
                            onPress={() => setSpecialty(s.value)}
                        >
                            <Text style={[styles.chipText, specialty === s.value && styles.chipTextActive]}>
                                {s.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <DatePickerField
                    label="Work Date *"
                    value={workDate}
                    onChange={setWorkDate}
                    placeholder="Select work date"
                    minDate={new Date().toISOString().split('T')[0]}
                />

                <View style={styles.row}>
                    <View style={styles.half}>
                        <TimePickerField
                            label="Start Time *"
                            value={startTime}
                            onChange={setStartTime}
                            placeholder="Start"
                        />
                    </View>
                    <View style={styles.half}>
                        <TimePickerField
                            label="End Time *"
                            value={endTime}
                            onChange={setEndTime}
                            placeholder="End"
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.half}>
                        <Text style={styles.label}>Pay (฿/day)</Text>
                        <TextInput style={styles.input} value={payAmount} onChangeText={setPayAmount}
                            keyboardType="numeric" placeholder="3000" placeholderTextColor={colors.text.disabled} />
                    </View>
                    <View style={styles.half}>
                        <Text style={styles.label}>Staff Needed</Text>
                        <TextInput style={styles.input} value={slotsNeeded} onChangeText={setSlotsNeeded}
                            keyboardType="numeric" placeholder="1" placeholderTextColor={colors.text.disabled} />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.toggleRow, isNegotiable && styles.toggleActive]}
                    onPress={() => setIsNegotiable(!isNegotiable)}
                >
                    <Text style={[styles.toggleText, isNegotiable && styles.toggleTextActive]}>
                        Pay is negotiable
                    </Text>
                </TouchableOpacity>

                <Text style={styles.label}>Requirements</Text>
                <TextInput style={[styles.input, styles.multiline]} value={requirements}
                    onChangeText={setRequirements} multiline numberOfLines={3}
                    placeholder="Job requirements..." placeholderTextColor={colors.text.disabled} textAlignVertical="top" />

                <Text style={styles.label}>Benefits</Text>
                <TextInput style={[styles.input, styles.multiline]} value={benefits}
                    onChangeText={setBenefits} multiline numberOfLines={3}
                    placeholder="Benefits offered..." placeholderTextColor={colors.text.disabled} textAlignVertical="top" />

                <Button
                    title="Save Changes"
                    onPress={handleSave}
                    isLoading={isSaving}
                    style={{ marginTop: spacing.lg }}
                />

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { padding: spacing.md },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    label: {
        fontSize: 13, fontWeight: '600', color: colors.text.secondary,
        marginBottom: spacing.xs, marginTop: spacing.md,
    },
    input: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.md,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        fontSize: 15, color: colors.text.primary,
        borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    multiline: { minHeight: 80, paddingTop: 14 },
    row: { flexDirection: 'row', gap: spacing.sm },
    half: { flex: 1 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadii.full,
        borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    chipActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
    chipText: { fontSize: 13, color: colors.text.secondary },
    chipTextActive: { color: colors.text.inverse, fontWeight: '600' },
    toggleRow: {
        flexDirection: 'row', alignItems: 'center', marginTop: spacing.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        borderRadius: borderRadii.md, borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    toggleActive: { backgroundColor: colors.primary.transparent, borderColor: colors.primary.DEFAULT },
    toggleText: { fontSize: 14, color: colors.text.secondary },
    toggleTextActive: { color: colors.primary.DEFAULT, fontWeight: '600' },
});

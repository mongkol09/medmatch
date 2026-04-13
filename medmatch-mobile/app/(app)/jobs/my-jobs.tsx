import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Briefcase, Users, Clock, CheckCircle, XCircle, RefreshCw, Edit3 } from 'lucide-react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api } from '../../../src/services/api';

interface Job {
    id: string;
    title: string;
    specialty_required: string;
    work_date: string;
    start_time: string;
    end_time: string;
    pay_amount?: number;
    pay_negotiable: boolean;
    status: 'OPEN' | 'FILLED' | 'CLOSED' | 'EXPIRED';
    _count?: { applications: number; matches: number };
    slots: number;
    created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    OPEN:    { label: 'Open',    color: colors.secondary.DEFAULT, bg: '#D1FAE5' },
    FILLED:  { label: 'Filled',  color: colors.primary.DEFAULT,   bg: colors.primary.transparent },
    CLOSED:  { label: 'Closed',  color: colors.text.disabled,     bg: colors.border.light },
    EXPIRED: { label: 'Expired', color: colors.semantic.error,    bg: '#FEE2E2' },
};

const SPECIALTY_SHORT: Record<string, string> = {
    DENTIST: 'Dentist',
    DOCTOR: 'Doctor',
    PHARMACIST: 'Pharm',
    NURSE: 'Nurse',
    DENTAL_ASSISTANT: 'Dent Asst',
    PHYSIOTHERAPIST: 'Physio',
    OTHER: 'Other',
};

export default function MyJobsScreen() {
    const router = useRouter();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'FILLED' | 'CLOSED'>('ALL');
    const [repostJobId, setRepostJobId] = useState<string | null>(null);
    const [repostDate, setRepostDate] = useState('');

    const fetchJobs = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/jobs/my');
            setJobs(res.data);
        } catch {
            // keep empty
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchJobs(); }, []);

    const handleClose = (jobId: string) => {
        Alert.alert('Close Job', 'This will mark the job as filled and stop new applications.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Close Job', style: 'destructive', onPress: async () => {
                    try {
                        await api.post(`/jobs/${jobId}/close`);
                        setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'CLOSED' } : j));
                    } catch { Alert.alert('Error', 'Could not close job.'); }
                }
            },
        ]);
    };

    const handleRepost = (jobId: string) => {
        const defaultDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        setRepostDate(defaultDate);
        setRepostJobId(jobId);
    };

    const confirmRepost = async () => {
        if (!repostJobId || !repostDate) return;
        try {
            await api.post(`/jobs/${repostJobId}/repost`, { newDate: repostDate });
            setRepostJobId(null);
            fetchJobs(true);
        } catch { Alert.alert('Error', 'Could not repost job.'); }
    };

    const filtered = filter === 'ALL' ? jobs : jobs.filter((j) => j.status === filter);

    const renderItem = ({ item }: { item: Job }) => {
        const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.CLOSED;
        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.cardMain}>
                        <View style={styles.titleRow}>
                            <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
                            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                                <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                            </View>
                        </View>
                        <Text style={styles.specialty}>
                            {SPECIALTY_SHORT[item.specialty_required] || item.specialty_required}
                        </Text>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Clock size={12} color={colors.text.disabled} />
                                <Text style={styles.metaText}>
                                    {item.work_date}  {item.start_time}–{item.end_time}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Users size={12} color={colors.text.disabled} />
                                <Text style={styles.metaText}>
                                    {item._count?.applications ?? 0} applicants · {item._count?.matches ?? 0}/{item.slots ?? 1} matched
                                </Text>
                            </View>
                            <Text style={[styles.pay, { color: colors.secondary.DEFAULT }]}>
                                {item.pay_negotiable ? 'Negotiable' : item.pay_amount ? `฿${item.pay_amount.toLocaleString()}` : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push(`/(app)/jobs/${item.id}/applicants` as any)}
                    >
                        <Users size={14} color={colors.primary.DEFAULT} />
                        <Text style={[styles.actionText, { color: colors.primary.DEFAULT }]}>
                            Applicants ({item._count?.applications ?? 0})
                        </Text>
                    </TouchableOpacity>

                    {item.status === 'OPEN' && (
                        <TouchableOpacity style={styles.actionBtn}
                            onPress={() => router.push(`/(app)/jobs/${item.id}/edit` as any)}>
                            <Edit3 size={14} color={colors.secondary.DEFAULT} />
                            <Text style={[styles.actionText, { color: colors.secondary.DEFAULT }]}>Edit</Text>
                        </TouchableOpacity>
                    )}

                    {item.status === 'OPEN' && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleClose(item.id)}>
                            <XCircle size={14} color={colors.semantic.error} />
                            <Text style={[styles.actionText, { color: colors.semantic.error }]}>Close</Text>
                        </TouchableOpacity>
                    )}

                    {(item.status === 'FILLED' || item.status === 'CLOSED' || item.status === 'EXPIRED') && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleRepost(item.id)}>
                            <RefreshCw size={14} color={colors.text.secondary} />
                            <Text style={[styles.actionText, { color: colors.text.secondary }]}>Repost</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Jobs</Text>
                <TouchableOpacity
                    style={styles.postBtn}
                    onPress={() => router.push('/(app)/jobs/post' as any)}
                >
                    <Plus size={18} color={colors.text.inverse} />
                    <Text style={styles.postBtnText}>Post Job</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterBar}>
                {(['ALL', 'OPEN', 'FILLED', 'CLOSED'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, filter === f && styles.filterChipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchJobs(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Briefcase size={44} color={colors.border.DEFAULT} />
                            <Text style={styles.emptyTitle}>
                                {filter === 'ALL' ? 'No jobs posted yet' : `No ${filter.toLowerCase()} jobs`}
                            </Text>
                            <Text style={styles.emptyDesc}>
                                Tap "Post Job" to find the right healthcare professional for your clinic.
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyPostBtn}
                                onPress={() => router.push('/(app)/jobs/post' as any)}
                            >
                                <Plus size={16} color={colors.text.inverse} />
                                <Text style={styles.emptyPostBtnText}>Post Your First Job</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* Repost Date Modal */}
            <Modal visible={!!repostJobId} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Repost Job</Text>
                        <Text style={styles.modalDesc}>Select a new work date</Text>
                        <Calendar
                            current={repostDate || undefined}
                            minDate={new Date().toISOString().split('T')[0]}
                            onDayPress={(day: DateData) => setRepostDate(day.dateString)}
                            markedDates={repostDate ? {
                                [repostDate]: { selected: true, selectedColor: colors.primary.DEFAULT },
                            } : {}}
                            theme={{
                                todayTextColor: colors.primary.DEFAULT,
                                arrowColor: colors.primary.DEFAULT,
                                selectedDayBackgroundColor: colors.primary.DEFAULT,
                                textDayFontSize: 15,
                                textMonthFontSize: 16,
                                textMonthFontWeight: 'bold',
                            }}
                        />
                        {repostDate ? (
                            <Text style={styles.selectedDateText}>
                                Selected: {new Date(repostDate + 'T00:00:00').toLocaleDateString('th-TH', {
                                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                })}
                            </Text>
                        ) : null}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRepostJobId(null)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, !repostDate && { opacity: 0.5 }]}
                                onPress={confirmRepost}
                                disabled={!repostDate}
                            >
                                <Text style={styles.modalConfirmText}>Repost</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    headerTitle: { fontSize: 26, fontWeight: 'bold', color: colors.text.primary },
    postBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.primary.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    postBtnText: { color: colors.text.inverse, fontSize: 14, fontWeight: '600' },
    filterBar: {
        flexDirection: 'row', gap: spacing.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    filterChip: {
        borderRadius: borderRadii.full, paddingHorizontal: spacing.md, paddingVertical: 5,
        borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    filterChipActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
    filterText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
    filterTextActive: { color: colors.text.inverse },
    listContent: { padding: spacing.md, paddingBottom: 80 },
    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        marginBottom: spacing.sm, ...shadows.sm, overflow: 'hidden',
    },
    cardTop: { padding: spacing.md },
    cardMain: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    jobTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, flex: 1, marginRight: spacing.sm },
    statusPill: { borderRadius: borderRadii.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
    specialty: { fontSize: 12, color: colors.text.secondary, marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: colors.text.disabled },
    pay: { fontSize: 13, fontWeight: '600' },
    cardActions: {
        flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, paddingVertical: spacing.sm,
        borderRightWidth: 1, borderRightColor: colors.border.light,
    },
    actionText: { fontSize: 12, fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xl },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    emptyDesc: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
    emptyPostBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.primary.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.xl,
    },
    emptyPostBtnText: { color: colors.text.inverse, fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: spacing.xl },
    modalSheet: { backgroundColor: colors.background.paper, borderRadius: borderRadii.lg, padding: spacing.xl },
    modalTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.xs },
    modalDesc: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing.md },
    selectedDateText: {
        fontSize: 14, color: colors.primary.DEFAULT, fontWeight: '600',
        textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xs,
    },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    modalCancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadii.md, borderWidth: 1, borderColor: colors.border.DEFAULT },
    modalCancelText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
    modalConfirmBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadii.md, backgroundColor: colors.primary.DEFAULT },
    modalConfirmText: { fontSize: 14, fontWeight: '600', color: colors.text.inverse },
});

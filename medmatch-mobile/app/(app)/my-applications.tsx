import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Briefcase, Clock, MapPin, Calendar, CheckCircle, XCircle } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

interface Application {
    id: string;
    status: ApplicationStatus;
    created_at: string;
    job: {
        id: string;
        title: string;
        work_date: string;
        start_time: string;
        end_time: string;
        pay_amount: number;
        pay_negotiable: boolean;
        status: string;
        clinic: { clinic_name: string; address: string };
    };
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
    PENDING:   { label: 'Pending',  color: '#92400E', bg: '#FEF3C7' },
    ACCEPTED:  { label: 'Accepted', color: '#065F46', bg: '#D1FAE5' },
    REJECTED:  { label: 'Rejected', color: colors.semantic.error, bg: '#FEE2E2' },
    CANCELLED: { label: 'Cancelled', color: colors.text.disabled, bg: colors.border.light },
};

const FILTER_TABS = ['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function MyApplicationsScreen() {
    const router = useRouter();
    const [applications, setApplications] = useState<Application[]>([]);
    const [pendingOffers, setPendingOffers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterTab>('ALL');

    const fetchApplications = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/jobs/my-applications');
            setApplications(res.data);

            // Fetch pending matches that need confirmation
            const matchesRes = await api.get('/jobs/matches');
            const pending = (matchesRes.data || []).filter((m: any) => m.status === 'SEEKER_PENDING');
            setPendingOffers(pending);
        } catch {
            // keep empty
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchApplications();
        }, [])
    );

    const handleWithdraw = (applicationId: string) => {
        Alert.alert(
            'Withdraw Application',
            'Are you sure you want to withdraw this application?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Withdraw',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post(`/jobs/applications/${applicationId}/withdraw`);
                            setApplications((prev) =>
                                prev.map((a) =>
                                    a.id === applicationId ? { ...a, status: 'CANCELLED' } : a
                                )
                            );
                        } catch {
                            Alert.alert('Error', 'Could not withdraw application.');
                        }
                    },
                },
            ]
        );
    };

    const handleConfirmOffer = async (matchId: string) => {
        Alert.alert(
            'Confirm Job',
            'Are you sure you want to confirm this job? You will be expected to work on the scheduled date.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        try {
                            await api.post(`/jobs/matches/${matchId}/confirm`);
                            setPendingOffers(prev => prev.filter(o => o.id !== matchId));
                            Alert.alert('Confirmed!', 'Job confirmed. View it on your calendar.', [
                                {
                                    text: 'View Calendar',
                                    onPress: () => router.push('/(app)/calendar' as any),
                                },
                                { text: 'OK' },
                            ]);
                        } catch (e: any) {
                            Alert.alert('Error', e.response?.data?.message || 'Failed to confirm.');
                        }
                    },
                },
            ]
        );
    };

    const handleDeclineOffer = async (matchId: string) => {
        Alert.alert(
            'Decline Job',
            'Are you sure you want to decline this offer? The clinic will need to find another provider.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post(`/jobs/matches/${matchId}/decline`);
                            setPendingOffers(prev => prev.filter(o => o.id !== matchId));
                        } catch (e: any) {
                            Alert.alert('Error', e.response?.data?.message || 'Failed to decline.');
                        }
                    },
                },
            ]
        );
    };

    const filtered = filter === 'ALL'
        ? applications
        : applications.filter((a) => a.status === filter);

    const renderItem = ({ item }: { item: Application }) => {
        const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.CANCELLED;
        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    {/* Title + Status */}
                    <View style={styles.titleRow}>
                        <Text style={styles.jobTitle} numberOfLines={1}>{item.job.title}</Text>
                        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                    </View>

                    {/* Clinic name */}
                    <Text style={styles.clinicName}>{item.job.clinic.clinic_name}</Text>

                    {/* Date & Time */}
                    <View style={styles.metaRow}>
                        <Clock size={12} color={colors.text.disabled} />
                        <Text style={styles.metaText}>
                            {item.job.work_date}  {item.job.start_time}–{item.job.end_time}
                        </Text>
                    </View>

                    {/* Location */}
                    {item.job.clinic.address ? (
                        <View style={styles.metaRow}>
                            <MapPin size={12} color={colors.text.disabled} />
                            <Text style={styles.metaText} numberOfLines={1}>{item.job.clinic.address}</Text>
                        </View>
                    ) : null}

                    {/* Pay */}
                    <Text style={styles.pay}>
                        {item.job.pay_negotiable
                            ? 'Negotiable'
                            : item.job.pay_amount
                                ? `฿${item.job.pay_amount.toLocaleString()}`
                                : '—'}
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                    {item.status === 'PENDING' && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleWithdraw(item.id)}
                        >
                            <Text style={[styles.actionText, { color: colors.semantic.error }]}>Withdraw</Text>
                        </TouchableOpacity>
                    )}
                    {item.status === 'ACCEPTED' && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => router.push('/(app)/calendar' as any)}
                        >
                            <Calendar size={14} color={colors.primary.DEFAULT} />
                            <Text style={[styles.actionText, { color: colors.primary.DEFAULT }]}>View Calendar</Text>
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
                <Text style={styles.headerTitle}>My Applications</Text>
            </View>

            {/* Pending Offers */}
            {pendingOffers.length > 0 && (
                <View style={styles.offersSection}>
                    <Text style={styles.offersSectionTitle}>
                        Pending Offers ({pendingOffers.length})
                    </Text>
                    <Text style={styles.offersSectionDesc}>
                        Please confirm or decline these job offers
                    </Text>
                    {pendingOffers.map(offer => (
                        <View key={offer.id} style={styles.offerCard}>
                            <View style={styles.offerInfo}>
                                <Text style={styles.offerTitle}>{offer.job?.title}</Text>
                                <Text style={styles.offerClinic}>{offer.clinic?.clinic_name}</Text>
                                <Text style={styles.offerMeta}>
                                    {offer.job?.work_date} · {offer.job?.start_time}–{offer.job?.end_time}
                                </Text>
                                {offer.job?.pay_amount && (
                                    <Text style={styles.offerPay}>฿{offer.job.pay_amount.toLocaleString()}</Text>
                                )}
                            </View>
                            <View style={styles.offerActions}>
                                <TouchableOpacity
                                    style={styles.declineBtn}
                                    onPress={() => handleDeclineOffer(offer.id)}
                                >
                                    <XCircle size={16} color={colors.semantic.error} />
                                    <Text style={[styles.offerActionText, { color: colors.semantic.error }]}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.confirmBtn}
                                    onPress={() => handleConfirmOffer(offer.id)}
                                >
                                    <CheckCircle size={16} color={colors.text.inverse} />
                                    <Text style={[styles.offerActionText, { color: colors.text.inverse }]}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Filter Bar */}
            <View style={styles.filterBar}>
                {FILTER_TABS.map((f) => (
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
                            onRefresh={() => { setIsRefreshing(true); fetchApplications(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Briefcase size={44} color={colors.border.DEFAULT} />
                            <Text style={styles.emptyTitle}>
                                {filter === 'ALL' ? 'No applications yet' : `No ${filter.toLowerCase()} applications`}
                            </Text>
                            <Text style={styles.emptyDesc}>
                                Swipe right on jobs you like to apply. Your applications will appear here.
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyActionBtn}
                                onPress={() => router.push('/(app)/jobs' as any)}
                            >
                                <Briefcase size={16} color={colors.text.inverse} />
                                <Text style={styles.emptyActionBtnText}>Find Jobs</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },

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
    titleRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
    },
    jobTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, flex: 1, marginRight: spacing.sm },
    statusPill: { borderRadius: borderRadii.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
    clinicName: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600', marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    metaText: { fontSize: 12, color: colors.text.disabled, flex: 1 },
    pay: { fontSize: 14, fontWeight: '700', color: colors.secondary.DEFAULT, marginTop: spacing.xs },

    cardActions: {
        flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border.light,
        minHeight: 0,
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, paddingVertical: spacing.sm,
    },
    actionText: { fontSize: 13, fontWeight: '600' },

    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xl },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    emptyDesc: {
        fontSize: 13, color: colors.text.secondary, textAlign: 'center',
        marginTop: spacing.sm, lineHeight: 20,
    },
    emptyActionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.primary.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.xl,
    },
    emptyActionBtnText: { color: colors.text.inverse, fontSize: 14, fontWeight: '600' },

    offersSection: {
        backgroundColor: colors.semantic.warning + '15',
        borderWidth: 1,
        borderColor: colors.semantic.warning + '40',
        borderRadius: borderRadii.lg,
        padding: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    offersSectionTitle: {
        fontSize: 16, fontWeight: 'bold', color: colors.text.primary,
        marginBottom: 2,
    },
    offersSectionDesc: {
        fontSize: 12, color: colors.text.secondary, marginBottom: spacing.md,
    },
    offerCard: {
        backgroundColor: colors.background.paper,
        borderRadius: borderRadii.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    offerInfo: { marginBottom: spacing.sm },
    offerTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    offerClinic: { fontSize: 13, color: colors.primary.DEFAULT, marginTop: 2 },
    offerMeta: { fontSize: 12, color: colors.text.disabled, marginTop: 4 },
    offerPay: { fontSize: 14, fontWeight: '700', color: colors.secondary.DEFAULT, marginTop: 4 },
    offerActions: { flexDirection: 'row', gap: spacing.sm },
    declineBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadii.md,
        borderWidth: 1.5, borderColor: colors.semantic.error, backgroundColor: '#FEF2F2',
    },
    confirmBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadii.md,
        backgroundColor: colors.primary.DEFAULT,
    },
    offerActionText: { fontSize: 14, fontWeight: '600' },
});

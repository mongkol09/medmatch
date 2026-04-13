/**
 * Treatment History Screen — PATIENT
 * Shows timeline of all past bookings with clinic name,
 * service, date, status, and payment info.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ChevronLeft, MapPin, Clock, CheckCircle, XCircle,
    AlertCircle, DollarSign, FileText
} from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

interface BookingRecord {
    id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: string;
    total_amount?: number;
    patient_notes?: string;
    clinic?: { clinic_name: string; address: string; images?: string[] };
    service?: { name: string; price: number };
    payments?: { status: string; amount: number }[];
}

const STATUS: Record<string, { label: string; color: string; icon: any }> = {
    COMPLETED:  { label: 'Completed',  color: colors.secondary.DEFAULT, icon: CheckCircle },
    CONFIRMED:  { label: 'Confirmed',  color: colors.primary.DEFAULT,   icon: CheckCircle },
    PENDING:    { label: 'Pending',    color: colors.semantic.warning,  icon: Clock },
    CANCELLED:  { label: 'Cancelled',  color: colors.semantic.error,    icon: XCircle },
    NO_SHOW:    { label: 'No Show',    color: colors.text.disabled,     icon: AlertCircle },
};

export default function TreatmentHistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [bookings, setBookings] = useState<BookingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'upcoming'>('all');

    const fetchHistory = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/booking/my');
            setBookings(Array.isArray(res.data) ? res.data : []);
        } catch {
            setBookings([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchHistory(); }, []);

    const today = new Date().toISOString().split('T')[0];

    const tabBookings = bookings.filter(b => {
        const date = b.booking_date?.split('T')[0] || '';
        if (activeTab === 'completed') return b.status === 'COMPLETED';
        if (activeTab === 'upcoming') return date >= today && b.status !== 'CANCELLED';
        return true;
    });

    // Group by year-month
    const grouped: Record<string, BookingRecord[]> = {};
    tabBookings.forEach(b => {
        const date = b.booking_date?.split('T')[0] || '';
        const key = date.slice(0, 7); // "YYYY-MM"
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(b);
    });
    const groupKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    const totalSpent = bookings
        .filter(b => b.status === 'COMPLETED')
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Treatment History</Text>
                <View style={{ width: 26 }} />
            </View>

            {/* Summary Banner */}
            <View style={styles.summaryBanner}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryNum}>{bookings.filter(b => b.status === 'COMPLETED').length}</Text>
                    <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryNum}>{bookings.filter(b => ['CONFIRMED','PENDING'].includes(b.status)).length}</Text>
                    <Text style={styles.summaryLabel}>Upcoming</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryNum}>฿{(totalSpent / 1000).toFixed(1)}k</Text>
                    <Text style={styles.summaryLabel}>Total Spent</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                {(['all', 'upcoming', 'completed'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : tabBookings.length === 0 ? (
                <View style={styles.centered}>
                    <FileText size={40} color={colors.border.DEFAULT} />
                    <Text style={styles.emptyText}>No treatment records</Text>
                    <Text style={styles.emptySubtext}>Book your first appointment!</Text>
                </View>
            ) : (
                <ScrollView
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchHistory(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    contentContainerStyle={styles.timelineContent}
                >
                    {groupKeys.map(key => {
                        const [year, month] = key.split('-');
                        const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                        return (
                            <View key={key}>
                                {/* Month Header */}
                                <Text style={styles.monthHeader}>{monthName}</Text>

                                {grouped[key].map((booking, idx) => {
                                    const cfg = STATUS[booking.status] || STATUS.PENDING;
                                    const StatusIcon = cfg.icon;
                                    const isLast = idx === grouped[key].length - 1;
                                    const date = booking.booking_date?.split('T')[0] || '';

                                    return (
                                        <View key={booking.id} style={styles.timelineItem}>
                                            {/* Timeline Line */}
                                            <View style={styles.timelineSide}>
                                                <View style={[styles.timelineDot, { backgroundColor: cfg.color }]} />
                                                {!isLast && <View style={styles.timelineLine} />}
                                            </View>

                                            {/* Card */}
                                            <TouchableOpacity
                                                style={styles.card}
                                                onPress={() => router.push(`/(app)/payment/${booking.id}` as any)}
                                                activeOpacity={0.7}
                                            >
                                                {/* Status Pill */}
                                                <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
                                                    <StatusIcon size={12} color={cfg.color} />
                                                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                                                </View>

                                                {/* Clinic */}
                                                <Text style={styles.clinicName} numberOfLines={1}>
                                                    {booking.clinic?.clinic_name || 'Clinic'}
                                                </Text>

                                                {booking.service && (
                                                    <Text style={styles.serviceName}>{booking.service.name}</Text>
                                                )}

                                                <View style={styles.metaRow}>
                                                    <View style={styles.metaItem}>
                                                        <Clock size={12} color={colors.text.disabled} />
                                                        <Text style={styles.metaText}>{date} · {booking.start_time}</Text>
                                                    </View>
                                                    {booking.clinic?.address && (
                                                        <View style={styles.metaItem}>
                                                            <MapPin size={12} color={colors.text.disabled} />
                                                            <Text style={styles.metaText} numberOfLines={1}>{booking.clinic.address}</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {booking.total_amount != null && (
                                                    <View style={styles.amountRow}>
                                                        <DollarSign size={13} color={colors.secondary.DEFAULT} />
                                                        <Text style={styles.amountText}>฿{booking.total_amount.toLocaleString()}</Text>
                                                    </View>
                                                )}

                                                {booking.patient_notes && (
                                                    <Text style={styles.notes} numberOfLines={2}>"{booking.patient_notes}"</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    summaryBanner: {
        flexDirection: 'row', backgroundColor: colors.primary.DEFAULT,
        paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNum: { fontSize: 22, fontWeight: 'bold', color: colors.text.inverse },
    summaryLabel: { fontSize: 11, color: colors.text.inverse + 'aa', marginTop: 2 },
    divider: { width: 1, backgroundColor: colors.text.inverse + '30', marginHorizontal: spacing.md },
    tabs: {
        flexDirection: 'row', backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary.DEFAULT },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.text.disabled },
    tabTextActive: { color: colors.primary.DEFAULT },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.text.secondary, marginTop: spacing.md },
    emptySubtext: { fontSize: 13, color: colors.text.disabled, marginTop: spacing.xs },
    timelineContent: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
    monthHeader: {
        fontSize: 13, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5,
        marginBottom: spacing.md, marginTop: spacing.sm,
    },
    timelineItem: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    timelineSide: { alignItems: 'center', paddingTop: 14 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 1 },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.border.light, marginTop: 4 },
    card: {
        flex: 1, backgroundColor: colors.background.paper,
        borderRadius: borderRadii.lg, padding: spacing.md, ...shadows.sm,
        marginBottom: 2,
    },
    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        alignSelf: 'flex-start', borderRadius: borderRadii.full,
        paddingHorizontal: spacing.sm, paddingVertical: 2, marginBottom: spacing.xs,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    clinicName: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
    serviceName: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing.xs },
    metaRow: { gap: 4, marginBottom: spacing.xs },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: colors.text.disabled },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
    amountText: { fontSize: 14, fontWeight: 'bold', color: colors.secondary.DEFAULT },
    notes: { fontSize: 12, color: colors.text.secondary, fontStyle: 'italic', marginTop: spacing.xs },
});

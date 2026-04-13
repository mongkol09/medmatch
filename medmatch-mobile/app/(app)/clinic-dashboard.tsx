import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    Calendar, Users, DollarSign, Briefcase, Plus, ChevronRight,
    Clock, CheckCircle, AlertCircle
} from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

interface TodayBooking {
    id: string;
    start_time: string;
    status: string;
    patient?: { full_name?: string };
    service?: { name: string };
}

interface DashboardStats {
    today_bookings: number;
    pending_bookings: number;
    open_jobs: number;
    pending_applicants: number;
    today_revenue: number;
    monthly_revenue: number;
}

const BOOKING_STATUS_COLOR: Record<string, string> = {
    PENDING:   colors.semantic.warning,
    CONFIRMED: colors.secondary.DEFAULT,
    COMPLETED: colors.text.disabled,
    CANCELLED: colors.semantic.error,
};

export default function ClinicDashboardScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
    const [clinicName, setClinicName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchDashboard = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [profileRes, bookingsRes, accountingRes, jobsRes] = await Promise.allSettled([
                api.get('/profile/clinic/me'),
                api.get('/booking/clinic/today'),
                api.get('/payments/accounting/dashboard'),
                api.get('/jobs/my'),
            ]);

            if (profileRes.status === 'fulfilled') {
                setClinicName(profileRes.value.data.clinic_name || '');
            }
            if (bookingsRes.status === 'fulfilled') {
                setTodayBookings(bookingsRes.value.data || []);
            }

            const jobs = jobsRes.status === 'fulfilled' ? jobsRes.value.data : [];
            const bookings = bookingsRes.status === 'fulfilled' ? bookingsRes.value.data : [];
            const accounting = accountingRes.status === 'fulfilled' ? accountingRes.value.data : null;

            setStats({
                today_bookings: bookings.length,
                pending_bookings: bookings.filter((b: any) => b.status === 'PENDING').length,
                open_jobs: jobs.filter((j: any) => j.status === 'OPEN').length,
                pending_applicants: jobs.reduce((sum: number, j: any) => sum + (j.application_count || 0), 0),
                today_revenue: accounting?.today?.total ?? 0,
                monthly_revenue: accounting?.month?.total ?? 0,
            });
        } catch {
            // Keep defaults
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchDashboard(); }, []);

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => { setIsRefreshing(true); fetchDashboard(true); }}
                    tintColor={colors.primary.DEFAULT}
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Good {getTimeOfDay()}, 👋</Text>
                    <Text style={styles.clinicNameText}>{clinicName || 'Your Clinic'}</Text>
                    <Text style={styles.dateText}>{today}</Text>
                </View>
                <TouchableOpacity
                    style={styles.postJobBtn}
                    onPress={() => router.push('/(app)/jobs/post' as any)}
                >
                    <Plus size={16} color={colors.text.inverse} />
                    <Text style={styles.postJobBtnText}>Post Job</Text>
                </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            {stats && (
                <View style={styles.statsGrid}>
                    <StatCard
                        icon={<Calendar size={22} color={colors.primary.DEFAULT} />}
                        label="Today's Bookings"
                        value={String(stats.today_bookings)}
                        sub={`${stats.pending_bookings} pending`}
                        color={colors.primary.DEFAULT}
                        onPress={() => router.push('/(app)/booking/clinic-today' as any)}
                    />
                    <StatCard
                        icon={<Briefcase size={22} color={colors.secondary.DEFAULT} />}
                        label="Open Jobs"
                        value={String(stats.open_jobs)}
                        sub={`${stats.pending_applicants} applicants`}
                        color={colors.secondary.DEFAULT}
                        onPress={() => router.push('/(app)/jobs/my-jobs' as any)}
                    />
                    <StatCard
                        icon={<DollarSign size={22} color={colors.semantic.warning} />}
                        label="Today's Revenue"
                        value={`฿${stats.today_revenue.toLocaleString()}`}
                        sub={`฿${stats.monthly_revenue.toLocaleString()} this month`}
                        color={colors.semantic.warning}
                        onPress={() => router.push('/(app)/accounting' as any)}
                    />
                    <StatCard
                        icon={<Users size={22} color="#8B5CF6" />}
                        label="Applicants"
                        value={String(stats.pending_applicants)}
                        sub="awaiting review"
                        color="#8B5CF6"
                        onPress={() => router.push('/(app)/jobs/my-jobs' as any)}
                    />
                </View>
            )}

            {/* Today's Schedule */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's Schedule</Text>
                    <TouchableOpacity onPress={() => router.push('/(app)/booking/clinic-today' as any)}>
                        <Text style={styles.seeAll}>See all</Text>
                    </TouchableOpacity>
                </View>

                {todayBookings.length === 0 ? (
                    <View style={styles.emptySlot}>
                        <Calendar size={28} color={colors.border.DEFAULT} />
                        <Text style={styles.emptySlotText}>No bookings today</Text>
                    </View>
                ) : (
                    todayBookings.slice(0, 5).map((booking) => (
                        <TouchableOpacity
                            key={booking.id}
                            style={styles.bookingRow}
                            onPress={() => router.push(`/(app)/payment/${booking.id}` as any)}
                        >
                            <View style={[styles.timeBar, { backgroundColor: BOOKING_STATUS_COLOR[booking.status] || colors.border.DEFAULT }]} />
                            <View style={styles.bookingInfo}>
                                <Text style={styles.bookingTime}>{booking.start_time}</Text>
                                <Text style={styles.bookingPatient}>
                                    {booking.patient?.full_name || 'Patient'}
                                </Text>
                                {booking.service && (
                                    <Text style={styles.bookingService}>{booking.service.name}</Text>
                                )}
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: BOOKING_STATUS_COLOR[booking.status] || colors.border.DEFAULT }]} />
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActions}>
                    <QuickAction
                        icon={<Plus size={20} color={colors.primary.DEFAULT} />}
                        label="Post Job"
                        onPress={() => router.push('/(app)/jobs/post' as any)}
                    />
                    <QuickAction
                        icon={<Users size={20} color={colors.secondary.DEFAULT} />}
                        label="Applicants"
                        onPress={() => router.push('/(app)/jobs/my-jobs' as any)}
                    />
                    <QuickAction
                        icon={<DollarSign size={20} color={colors.semantic.warning} />}
                        label="Accounting"
                        onPress={() => router.push('/(app)/accounting' as any)}
                    />
                    <QuickAction
                        icon={<CheckCircle size={20} color="#8B5CF6" />}
                        label="Edit Profile"
                        onPress={() => router.push('/(app)/clinic-profile/edit' as any)}
                    />
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

function getTimeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

function StatCard({ icon, label, value, sub, color, onPress }: {
    icon: React.ReactNode; label: string; value: string;
    sub: string; color: string; onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>{icon}</View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statSub}>{sub}</Text>
        </TouchableOpacity>
    );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.quickActionIcon}>{icon}</View>
            <Text style={styles.quickActionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { paddingBottom: 80 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT },
    header: {
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
        paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
        backgroundColor: colors.primary.DEFAULT,
    },
    greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
    clinicNameText: { fontSize: 22, fontWeight: 'bold', color: colors.text.inverse, marginBottom: 2 },
    dateText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
    postJobBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    },
    postJobBtnText: { color: colors.text.inverse, fontSize: 13, fontWeight: '600' },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
        padding: spacing.md, marginTop: -spacing.lg,
    },
    statCard: {
        width: '47%', backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, ...shadows.md,
    },
    statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
    statValue: { fontSize: 22, fontWeight: 'bold', color: colors.text.primary },
    statLabel: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    statSub: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    seeAll: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '700' },
    emptySlot: { alignItems: 'center', paddingVertical: spacing.xl },
    emptySlotText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
    bookingRow: {
        flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm,
        backgroundColor: '#F8FAFF', borderRadius: borderRadii.md, overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border.light,
    },
    timeBar: { width: 4, alignSelf: 'stretch' },
    bookingInfo: { flex: 1, padding: spacing.sm },
    bookingTime: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    bookingPatient: { fontSize: 14, color: colors.text.primary, marginTop: 2, fontWeight: '600' },
    bookingService: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
    statusDot: { width: 10, height: 10, borderRadius: 5, margin: spacing.md },
    quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
    quickAction: { alignItems: 'center', flex: 1 },
    quickActionIcon: {
        width: 52, height: 52, borderRadius: 16,
        backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.xs,
        shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    },
    quickActionLabel: { fontSize: 11, color: colors.text.secondary, textAlign: 'center', fontWeight: '600' },
});

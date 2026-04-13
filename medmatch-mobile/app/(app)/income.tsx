/**
 * Income Summary Screen — SEEKER
 * Shows monthly earnings from completed job matches,
 * with per-clinic breakdown and yearly totals.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ChevronLeft, DollarSign, TrendingUp, Briefcase, CheckCircle,
    Clock, Calendar
} from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface MatchRecord {
    id: string;
    final_pay_amount?: number;
    status: string;
    created_at: string;
    job?: {
        title: string;
        work_date: string;
        pay_amount: number;
        clinic?: { clinic_name: string; address: string };
    };
}

interface MonthStats {
    total: number;
    confirmed: number;
    completed: number;
    matchCount: number;
}

export default function IncomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [matches, setMatches] = useState<MatchRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchMatches = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/jobs/matches');
            setMatches(Array.isArray(res.data) ? res.data : []);
        } catch {
            setMatches([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchMatches(); }, []);

    const prevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
        else setSelectedMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
        else setSelectedMonth(m => m + 1);
    };

    // Filter to selected month/year by work_date
    const monthMatches = matches.filter(m => {
        const date = m.job?.work_date;
        if (!date) return false;
        const d = new Date(date);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });

    // Year total
    const yearTotal = matches
        .filter(m => {
            const date = m.job?.work_date;
            if (!date) return false;
            return new Date(date).getFullYear() === selectedYear;
        })
        .reduce((sum, m) => sum + (m.final_pay_amount ?? m.job?.pay_amount ?? 0), 0);

    // Month stats
    const stats: MonthStats = monthMatches.reduce((acc, m) => {
        const pay = m.final_pay_amount ?? m.job?.pay_amount ?? 0;
        acc.total += pay;
        acc.matchCount++;
        if (m.status === 'COMPLETED') acc.completed += pay;
        else if (m.status === 'CONFIRMED') acc.confirmed += pay;
        return acc;
    }, { total: 0, confirmed: 0, completed: 0, matchCount: 0 });

    // Per-clinic breakdown
    const byClinic: Record<string, { name: string; total: number; shifts: number }> = {};
    monthMatches.forEach(m => {
        const name = m.job?.clinic?.clinic_name || 'Unknown Clinic';
        const pay = m.final_pay_amount ?? m.job?.pay_amount ?? 0;
        if (!byClinic[name]) byClinic[name] = { name, total: 0, shifts: 0 };
        byClinic[name].total += pay;
        byClinic[name].shifts++;
    });
    const clinicList = Object.values(byClinic).sort((a, b) => b.total - a.total);

    // 6-month bar chart data
    const barData = Array.from({ length: 6 }, (_, i) => {
        let m = selectedMonth - 5 + i;
        let y = selectedYear;
        while (m <= 0) { m += 12; y--; }
        while (m > 12) { m -= 12; y++; }
        const monthTotal = matches
            .filter(match => {
                const date = match.job?.work_date;
                if (!date) return false;
                const d = new Date(date);
                return d.getFullYear() === y && d.getMonth() + 1 === m;
            })
            .reduce((sum, match) => sum + (match.final_pay_amount ?? match.job?.pay_amount ?? 0), 0);
        return { month: MONTHS[m - 1], total: monthTotal, isCurrent: i === 5 };
    });
    const maxBar = Math.max(...barData.map(b => b.total), 1);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Income Summary</Text>
                <View style={{ width: 26 }} />
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <ScrollView
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchMatches(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                >
                    {/* Year total banner */}
                    <View style={styles.yearBanner}>
                        <TrendingUp size={20} color={colors.text.inverse} />
                        <Text style={styles.yearLabel}>{selectedYear} Total Earnings</Text>
                        <Text style={styles.yearAmount}>฿{yearTotal.toLocaleString()}</Text>
                    </View>

                    {/* Month picker */}
                    <View style={styles.monthPicker}>
                        <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
                            <Text style={styles.monthArrow}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.monthLabel}>{MONTHS[selectedMonth - 1]} {selectedYear}</Text>
                        <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
                            <Text style={styles.monthArrow}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 6-month Bar Chart */}
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Last 6 Months</Text>
                        <View style={styles.bars}>
                            {barData.map((b, i) => (
                                <View key={i} style={styles.barItem}>
                                    <Text style={styles.barAmount}>
                                        {b.total > 0 ? `${(b.total / 1000).toFixed(1)}k` : ''}
                                    </Text>
                                    <View style={styles.barTrack}>
                                        <View style={[
                                            styles.barFill,
                                            {
                                                height: `${(b.total / maxBar) * 100}%`,
                                                backgroundColor: b.isCurrent ? colors.primary.DEFAULT : colors.primary.DEFAULT + '40',
                                            },
                                        ]} />
                                    </View>
                                    <Text style={[styles.barMonth, b.isCurrent && styles.barMonthActive]}>{b.month}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Month Stats */}
                    <View style={styles.statsGrid}>
                        <StatCard icon={<DollarSign size={20} color={colors.secondary.DEFAULT} />}
                            label="Month Total" value={`฿${stats.total.toLocaleString()}`}
                            color={colors.secondary.DEFAULT} />
                        <StatCard icon={<Briefcase size={20} color={colors.primary.DEFAULT} />}
                            label="Shifts" value={String(stats.matchCount)}
                            color={colors.primary.DEFAULT} />
                        <StatCard icon={<CheckCircle size={20} color={colors.semantic.success} />}
                            label="Completed" value={`฿${stats.completed.toLocaleString()}`}
                            color={colors.semantic.success} />
                        <StatCard icon={<Clock size={20} color={colors.semantic.warning} />}
                            label="Upcoming" value={`฿${stats.confirmed.toLocaleString()}`}
                            color={colors.semantic.warning} />
                    </View>

                    {/* Per-Clinic Breakdown */}
                    {clinicList.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>By Clinic</Text>
                            {clinicList.map(c => (
                                <View key={c.name} style={styles.clinicRow}>
                                    <View style={styles.clinicIcon}>
                                        <Briefcase size={16} color={colors.primary.DEFAULT} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.clinicName} numberOfLines={1}>{c.name}</Text>
                                        <Text style={styles.clinicSub}>{c.shifts} shift{c.shifts > 1 ? 's' : ''}</Text>
                                    </View>
                                    <Text style={styles.clinicTotal}>฿{c.total.toLocaleString()}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Shift History */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Shifts this month ({monthMatches.length})
                        </Text>
                        {monthMatches.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Calendar size={28} color={colors.border.DEFAULT} />
                                <Text style={styles.emptyText}>No shifts recorded</Text>
                            </View>
                        ) : (
                            monthMatches.map(m => {
                                const pay = m.final_pay_amount ?? m.job?.pay_amount ?? 0;
                                const isCompleted = m.status === 'COMPLETED';
                                return (
                                    <View key={m.id} style={styles.shiftRow}>
                                        <View style={[
                                            styles.shiftDot,
                                            { backgroundColor: isCompleted ? colors.secondary.DEFAULT : colors.primary.DEFAULT },
                                        ]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.shiftTitle} numberOfLines={1}>
                                                {m.job?.title || 'Shift'}
                                            </Text>
                                            <Text style={styles.shiftClinic} numberOfLines={1}>
                                                {m.job?.clinic?.clinic_name} · {m.job?.work_date}
                                            </Text>
                                        </View>
                                        <View style={styles.shiftRight}>
                                            <Text style={[
                                                styles.shiftPay,
                                                { color: isCompleted ? colors.secondary.DEFAULT : colors.primary.DEFAULT },
                                            ]}>
                                                ฿{pay.toLocaleString()}
                                            </Text>
                                            <Text style={styles.shiftStatus}>{m.status}</Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

function StatCard({ icon, label, value, color }: {
    icon: React.ReactNode; label: string; value: string; color: string;
}) {
    return (
        <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>{icon}</View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
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
    yearBanner: {
        backgroundColor: colors.primary.DEFAULT, padding: spacing.lg,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    },
    yearLabel: { fontSize: 14, color: colors.text.inverse + 'cc', flex: 1 },
    yearAmount: { fontSize: 22, fontWeight: 'bold', color: colors.text.inverse },
    monthPicker: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background.paper, paddingVertical: spacing.sm,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    monthBtn: { padding: spacing.lg },
    monthArrow: { fontSize: 24, color: colors.primary.DEFAULT, fontWeight: '300' },
    monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text.primary, minWidth: 130, textAlign: 'center' },
    chartCard: {
        backgroundColor: colors.background.paper, margin: spacing.md,
        borderRadius: borderRadii.lg, padding: spacing.lg, ...shadows.sm,
    },
    chartTitle: { fontSize: 14, fontWeight: '700', color: colors.text.secondary, marginBottom: spacing.md },
    bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: spacing.sm },
    barItem: { flex: 1, alignItems: 'center' },
    barAmount: { fontSize: 9, color: colors.text.disabled, marginBottom: 2 },
    barTrack: { width: '100%', height: 80, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border.light },
    barFill: { width: '100%', borderRadius: 4 },
    barMonth: { fontSize: 10, color: colors.text.disabled, marginTop: 4 },
    barMonthActive: { color: colors.primary.DEFAULT, fontWeight: '700' },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
        paddingHorizontal: spacing.md, marginBottom: spacing.md,
    },
    statCard: {
        width: '47%', backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, ...shadows.sm,
    },
    statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
    statValue: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
    statLabel: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.lg, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 14, fontWeight: '700', color: colors.text.secondary,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    clinicRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    clinicIcon: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: colors.primary.transparent,
        justifyContent: 'center', alignItems: 'center',
    },
    clinicName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    clinicSub: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    clinicTotal: { fontSize: 16, fontWeight: 'bold', color: colors.secondary.DEFAULT },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
    emptyText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
    shiftRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    shiftDot: { width: 10, height: 10, borderRadius: 5 },
    shiftTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    shiftClinic: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    shiftRight: { alignItems: 'flex-end' },
    shiftPay: { fontSize: 15, fontWeight: 'bold' },
    shiftStatus: { fontSize: 10, color: colors.text.disabled, marginTop: 2 },
});

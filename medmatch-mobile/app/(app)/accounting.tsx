import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, DollarSign, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

interface PaymentRecord {
    id: string;
    amount: number;
    status: string;
    payment_method?: string;
    created_at: string;
    booking?: {
        booking_date: string;
        patient?: { full_name?: string };
        service?: { name: string };
    };
}

interface AccountingSummary {
    total: number;
    verified: number;
    pending: number;
    count: number;
}

const STATUS_ICON: Record<string, { icon: any; color: string; label: string }> = {
    VERIFIED:  { icon: CheckCircle, color: colors.semantic.success, label: 'Paid' },
    PENDING:   { icon: Clock,       color: colors.semantic.warning, label: 'Pending' },
    REJECTED:  { icon: AlertCircle, color: colors.semantic.error,   label: 'Rejected' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AccountingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [summary, setSummary] = useState<AccountingSummary | null>(null);
    const [history, setHistory] = useState<PaymentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [summaryRes, historyRes] = await Promise.all([
                api.get('/payments/accounting/monthly', {
                    params: { year: selectedYear, month: selectedMonth },
                }),
                api.get('/payments/history'),
            ]);
            setSummary(summaryRes.data);
            setHistory(historyRes.data || []);
        } catch {
            setSummary(null);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchData(); }, [selectedYear, selectedMonth]);

    const prevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
        else setSelectedMonth((m) => m - 1);
    };

    const nextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
        else setSelectedMonth((m) => m + 1);
    };

    // Build 6-month bar chart data
    const barData = Array.from({ length: 6 }, (_, i) => {
        let m = selectedMonth - 5 + i;
        let y = selectedYear;
        while (m <= 0) { m += 12; y--; }
        const monthTotal = history
            .filter(p => {
                if (!p.created_at) return false;
                const d = new Date(p.created_at);
                return d.getFullYear() === y && d.getMonth() + 1 === m && p.status === 'VERIFIED';
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        return { label: MONTHS[m - 1], total: monthTotal, isCurrent: i === 5 };
    });
    const maxBar = Math.max(...barData.map(b => b.total), 1);

    const filteredHistory = history.filter((p) => {
        if (!p.created_at) return false;
        const d = new Date(p.created_at);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });

    const renderPayment = ({ item }: { item: PaymentRecord }) => {
        const sc = STATUS_ICON[item.status] || STATUS_ICON['PENDING'];
        const StatusIcon = sc.icon;
        return (
            <View style={styles.paymentRow}>
                <View style={[styles.paymentIconWrap, { backgroundColor: sc.color + '18' }]}>
                    <StatusIcon size={18} color={sc.color} />
                </View>
                <View style={styles.paymentInfo}>
                    <Text style={styles.paymentPatient} numberOfLines={1}>
                        {item.booking?.patient?.full_name || 'Patient'}
                    </Text>
                    <Text style={styles.paymentSub}>
                        {item.booking?.booking_date?.split('T')[0] || '—'}
                        {item.booking?.service ? `  ·  ${item.booking.service.name}` : ''}
                    </Text>
                </View>
                <View style={styles.paymentRight}>
                    <Text style={[styles.paymentAmount, item.status === 'VERIFIED' && { color: colors.semantic.success }]}>
                        ฿{item.amount.toLocaleString()}
                    </Text>
                    <Text style={[styles.paymentStatus, { color: sc.color }]}>{sc.label}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Accounting</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => { setIsRefreshing(true); fetchData(true); }}
                        tintColor={colors.primary.DEFAULT}
                    />
                }
            >
                {/* Month Picker */}
                <View style={styles.monthPicker}>
                    <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
                        <Text style={styles.monthBtnText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.monthLabel}>
                        {MONTHS[selectedMonth - 1]} {selectedYear}
                    </Text>
                    <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
                        <Text style={styles.monthBtnText}>›</Text>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                    </View>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <View style={styles.summaryGrid}>
                            <SummaryCard
                                icon={<DollarSign size={20} color={colors.secondary.DEFAULT} />}
                                label="Total Revenue"
                                value={`฿${(summary?.total ?? 0).toLocaleString()}`}
                                color={colors.secondary.DEFAULT}
                            />
                            <SummaryCard
                                icon={<CheckCircle size={20} color={colors.semantic.success} />}
                                label="Verified"
                                value={`฿${(summary?.verified ?? 0).toLocaleString()}`}
                                color={colors.semantic.success}
                            />
                            <SummaryCard
                                icon={<Clock size={20} color={colors.semantic.warning} />}
                                label="Pending"
                                value={`฿${(summary?.pending ?? 0).toLocaleString()}`}
                                color={colors.semantic.warning}
                            />
                            <SummaryCard
                                icon={<TrendingUp size={20} color={colors.primary.DEFAULT} />}
                                label="Transactions"
                                value={String(summary?.count ?? 0)}
                                color={colors.primary.DEFAULT}
                            />
                        </View>

                        {/* 6-Month Revenue Chart */}
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Revenue Trend (6 months)</Text>
                            <View style={styles.chartBars}>
                                {barData.map((b, i) => (
                                    <View key={i} style={styles.chartBarItem}>
                                        <Text style={styles.chartBarAmount}>
                                            {b.total > 0 ? `${(b.total / 1000).toFixed(1)}k` : ''}
                                        </Text>
                                        <View style={styles.chartBarTrack}>
                                            <View style={[
                                                styles.chartBarFill,
                                                {
                                                    height: `${(b.total / maxBar) * 100}%`,
                                                    backgroundColor: b.isCurrent
                                                        ? colors.secondary.DEFAULT
                                                        : colors.secondary.DEFAULT + '40',
                                                },
                                            ]} />
                                        </View>
                                        <Text style={[styles.chartBarLabel, b.isCurrent && styles.chartBarLabelActive]}>
                                            {b.label}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Verified vs Pending Progress Bar */}
                        {(summary?.total ?? 0) > 0 && (
                            <View style={styles.revenueBar}>
                                <Text style={styles.revBarLabel}>Verified vs Pending</Text>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            {
                                                width: `${((summary?.verified ?? 0) / (summary?.total ?? 1)) * 100}%`,
                                                backgroundColor: colors.semantic.success,
                                            },
                                        ]}
                                    />
                                </View>
                                <View style={styles.barLegend}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: colors.semantic.success }]} />
                                        <Text style={styles.legendText}>Verified ฿{(summary?.verified ?? 0).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: colors.semantic.warning }]} />
                                        <Text style={styles.legendText}>Pending ฿{(summary?.pending ?? 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Transaction History */}
                        <View style={styles.historySection}>
                            <Text style={styles.historySectionTitle}>
                                Transactions ({filteredHistory.length})
                            </Text>
                            {filteredHistory.length === 0 ? (
                                <View style={styles.emptyHistory}>
                                    <DollarSign size={32} color={colors.border.DEFAULT} />
                                    <Text style={styles.emptyHistoryText}>No transactions this month</Text>
                                </View>
                            ) : (
                                filteredHistory.map((p) => (
                                    <React.Fragment key={p.id}>
                                        {renderPayment({ item: p })}
                                    </React.Fragment>
                                ))
                            )}
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function SummaryCard({ icon, label, value, color }: {
    icon: React.ReactNode; label: string; value: string; color: string;
}) {
    return (
        <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: color + '18' }]}>{icon}</View>
            <Text style={styles.summaryValue}>{value}</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { paddingVertical: 60, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    monthPicker: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background.paper, padding: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    monthBtn: { padding: spacing.md },
    monthBtnText: { fontSize: 24, color: colors.primary.DEFAULT, fontWeight: '300' },
    monthLabel: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary, minWidth: 140, textAlign: 'center' },
    summaryGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md,
    },
    summaryCard: {
        width: '47%', backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, ...shadows.sm,
    },
    summaryIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
    summaryValue: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
    summaryLabel: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    revenueBar: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.sm,
    },
    revBarLabel: { fontSize: 13, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.sm },
    barTrack: { height: 10, backgroundColor: colors.border.light, borderRadius: 5, overflow: 'hidden', marginBottom: spacing.sm },
    barFill: { height: '100%', borderRadius: 5 },
    barLegend: { flexDirection: 'row', gap: spacing.xl },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: colors.text.secondary },
    historySection: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.sm,
    },
    historySectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
    paymentRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    paymentIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    paymentInfo: { flex: 1 },
    paymentPatient: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    paymentSub: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    paymentRight: { alignItems: 'flex-end' },
    paymentAmount: { fontSize: 15, fontWeight: 'bold', color: colors.text.primary },
    paymentStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    emptyHistory: { alignItems: 'center', paddingVertical: spacing.xl },
    emptyHistoryText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
    chartCard: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.sm,
    },
    chartTitle: { fontSize: 14, fontWeight: '700', color: colors.text.secondary, marginBottom: spacing.md },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: spacing.sm },
    chartBarItem: { flex: 1, alignItems: 'center' },
    chartBarAmount: { fontSize: 9, color: colors.text.disabled, marginBottom: 2 },
    chartBarTrack: { width: '100%', height: 80, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border.light },
    chartBarFill: { width: '100%', borderRadius: 4 },
    chartBarLabel: { fontSize: 10, color: colors.text.disabled, marginTop: 4 },
    chartBarLabelActive: { color: colors.secondary.DEFAULT, fontWeight: '700' },
});

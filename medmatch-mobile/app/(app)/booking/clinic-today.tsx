import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Clock, User, CheckCircle, XCircle, Phone } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api } from '../../../src/services/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PENDING:   { label: 'Pending',   color: colors.semantic.warning, icon: Clock },
    CONFIRMED: { label: 'Confirmed', color: colors.primary.DEFAULT,  icon: CheckCircle },
    COMPLETED: { label: 'Completed', color: colors.secondary.DEFAULT, icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', color: colors.semantic.error,   icon: XCircle },
    NO_SHOW:   { label: 'No Show',   color: colors.text.disabled,    icon: XCircle },
};

interface TodayBooking {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    patient_notes?: string;
    patient?: {
        id: string;
        first_name?: string;
        last_name?: string;
        first_name_enc?: any;
        last_name_enc?: any;
        profile_image_url?: string;
    };
    service?: {
        name: string;
        price: number;
    };
    total_amount?: number;
}

export default function ClinicTodayBookingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [bookings, setBookings] = useState<TodayBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchBookings = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/booking/clinic/today');
            setBookings(Array.isArray(res.data) ? res.data : []);
        } catch {
            setBookings([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchBookings(); }, []);

    const handleConfirm = async (bookingId: string) => {
        try {
            await api.put(`/booking/${bookingId}/confirm`);
            fetchBookings(true);
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to confirm booking.');
        }
    };

    const handleComplete = async (bookingId: string) => {
        try {
            await api.put(`/booking/${bookingId}/complete`);
            fetchBookings(true);
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to complete booking.');
        }
    };

    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const pending = bookings.filter((b) => b.status === 'PENDING').length;
    const confirmed = bookings.filter((b) => b.status === 'CONFIRMED').length;
    const completed = bookings.filter((b) => b.status === 'COMPLETED').length;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Today's Bookings</Text>
                <View style={{ width: 26 }} />
            </View>

            {/* Date + Stats */}
            <View style={styles.dateBar}>
                <Text style={styles.dateText}>{today}</Text>
                <View style={styles.statsRow}>
                    <MiniStat value={bookings.length} label="Total" color={colors.text.primary} />
                    <MiniStat value={pending} label="Pending" color={colors.semantic.warning} />
                    <MiniStat value={confirmed} label="Confirmed" color={colors.primary.DEFAULT} />
                    <MiniStat value={completed} label="Done" color={colors.secondary.DEFAULT} />
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : bookings.length === 0 ? (
                <View style={styles.centered}>
                    <Clock size={40} color={colors.border.DEFAULT} />
                    <Text style={styles.emptyText}>No bookings today</Text>
                    <Text style={styles.emptySubtext}>Enjoy your day off!</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchBookings(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                >
                    {bookings.map((booking) => {
                        const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
                        const StatusIcon = cfg.icon;

                        return (
                            <View key={booking.id} style={styles.card}>
                                {/* Time + Status */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.timeBlock}>
                                        <Clock size={14} color={colors.primary.DEFAULT} />
                                        <Text style={styles.timeText}>
                                            {booking.start_time} – {booking.end_time}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
                                        <StatusIcon size={12} color={cfg.color} />
                                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                                    </View>
                                </View>

                                {/* Patient Info */}
                                <View style={styles.patientRow}>
                                    <View style={styles.patientAvatar}>
                                        <User size={18} color={colors.text.disabled} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.patientName}>
                                            {booking.patient?.first_name
                                                ? `${booking.patient.first_name} ${booking.patient.last_name || ''}`.trim()
                                                : `Patient #${booking.id.slice(-6)}`}
                                        </Text>
                                        {booking.service && (
                                            <Text style={styles.serviceText}>{booking.service.name}</Text>
                                        )}
                                    </View>
                                    {booking.total_amount != null && (
                                        <Text style={styles.amountText}>฿{booking.total_amount.toLocaleString()}</Text>
                                    )}
                                </View>

                                {booking.patient_notes && (
                                    <Text style={styles.notesText}>Note: {booking.patient_notes}</Text>
                                )}

                                {/* Actions */}
                                {booking.status === 'PENDING' && (
                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.confirmBtn]}
                                            onPress={() => handleConfirm(booking.id)}
                                        >
                                            <CheckCircle size={14} color={colors.text.inverse} />
                                            <Text style={styles.actionBtnText}>Confirm</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {booking.status === 'CONFIRMED' && (
                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.completeBtn]}
                                            onPress={() => handleComplete(booking.id)}
                                        >
                                            <CheckCircle size={14} color={colors.text.inverse} />
                                            <Text style={styles.actionBtnText}>Mark Complete</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
    return (
        <View style={styles.miniStat}>
            <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
            <Text style={styles.miniStatLabel}>{label}</Text>
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
    dateBar: {
        backgroundColor: colors.background.paper,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    dateText: { fontSize: 14, color: colors.text.secondary, marginBottom: spacing.sm },
    statsRow: { flexDirection: 'row', gap: spacing.lg },
    miniStat: { alignItems: 'center' },
    miniStatValue: { fontSize: 20, fontWeight: 'bold' },
    miniStatLabel: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.text.secondary, marginTop: spacing.md },
    emptySubtext: { fontSize: 14, color: colors.text.disabled, marginTop: spacing.xs },
    list: { padding: spacing.md },
    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.lg, marginBottom: spacing.sm, ...shadows.sm,
        borderLeftWidth: 3, borderLeftColor: colors.primary.DEFAULT,
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    timeBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadii.full,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    patientRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    patientAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    patientName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    serviceText: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
    amountText: { fontSize: 15, fontWeight: '700', color: colors.secondary.DEFAULT },
    notesText: {
        fontSize: 12, color: colors.text.secondary, fontStyle: 'italic',
        marginTop: spacing.xs, paddingTop: spacing.xs,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    actions: {
        flexDirection: 'row', gap: spacing.sm,
        marginTop: spacing.sm, paddingTop: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadii.md,
    },
    confirmBtn: { backgroundColor: colors.primary.DEFAULT },
    completeBtn: { backgroundColor: colors.secondary.DEFAULT },
    actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.inverse },
});

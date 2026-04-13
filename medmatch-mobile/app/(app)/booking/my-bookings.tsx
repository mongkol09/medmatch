import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Clock, MapPin, DollarSign, ChevronRight } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, resolveImageUrl } from '../../../src/services/api';

interface Booking {
    id: string;
    booking_date: string;
    start_time: string;
    status: string;
    payment_status?: string;
    total_amount?: number;
    clinic: {
        clinic_name: string;
        address: string;
        images?: string[];
        consultation_fee?: number;
    };
    service?: { name: string };
}

type Filter = 'UPCOMING' | 'PAST' | 'CANCELLED';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    PENDING:           { label: 'Pending',    color: colors.semantic.warning,  bg: '#FEF3C7' },
    CONFIRMED:         { label: 'Confirmed',  color: colors.secondary.DEFAULT, bg: '#D1FAE5' },
    COMPLETED:         { label: 'Completed',  color: colors.text.disabled,     bg: colors.border.light },
    CANCELLED:         { label: 'Cancelled',  color: colors.semantic.error,    bg: '#FEE2E2' },
    PENDING_PAYMENT:   { label: 'Awaiting Payment', color: colors.semantic.warning, bg: '#FEF3C7' },
    PAYMENT_VERIFIED:  { label: 'Paid',       color: colors.secondary.DEFAULT, bg: '#D1FAE5' },
};

export default function MyBookingsScreen() {
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<Filter>('UPCOMING');

    const fetchBookings = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/booking/my');
            setBookings(res.data);
        } catch {
            // keep empty
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchBookings(); }, []);

    const handleCancel = (bookingId: string) => {
        Alert.alert(
            'Cancel Booking',
            'Are you sure you want to cancel this appointment?',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Cancel Booking',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.put(`/booking/${bookingId}/cancel`);
                            setBookings(prev =>
                                prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' } : b)
                            );
                        } catch (e: any) {
                            Alert.alert('Failed', e.response?.data?.message || 'Could not cancel booking.');
                        }
                    },
                },
            ],
        );
    };

    const today = new Date().toISOString().split('T')[0];

    const filtered = bookings.filter((b) => {
        const date = b.booking_date?.split('T')[0] || '';
        if (filter === 'UPCOMING') return date >= today && b.status !== 'CANCELLED';
        if (filter === 'PAST') return date < today && b.status !== 'CANCELLED';
        if (filter === 'CANCELLED') return b.status === 'CANCELLED';
        return true;
    });

    const renderItem = ({ item }: { item: Booking }) => {
        const statusKey = item.payment_status || item.status;
        const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG['PENDING'];
        const date = item.booking_date?.split('T')[0] || '—';
        const fee = item.total_amount ?? item.clinic?.consultation_fee;

        return (
            <View key={item.id}>
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push(`/(app)/payment/${item.id}` as any)}
                    activeOpacity={0.8}
                >
                    <View style={styles.cardLeft}>
                        {item.clinic.images?.[0] ? (
                            <Image source={{ uri: resolveImageUrl(item.clinic.images[0]) }} style={styles.clinicImg} />
                        ) : (
                            <View style={[styles.clinicImg, styles.clinicImgPlaceholder]} />
                        )}
                    </View>

                    <View style={styles.cardInfo}>
                        <View style={styles.topRow}>
                            <Text style={styles.clinicName} numberOfLines={1}>{item.clinic.clinic_name}</Text>
                            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                                <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                            </View>
                        </View>

                        {item.service && (
                            <Text style={styles.serviceName} numberOfLines={1}>{item.service.name}</Text>
                        )}

                        <View style={styles.metaGrid}>
                            <View style={styles.metaItem}>
                                <Calendar size={12} color={colors.text.disabled} />
                                <Text style={styles.metaText}>{date}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Clock size={12} color={colors.text.disabled} />
                                <Text style={styles.metaText}>{item.start_time}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <MapPin size={12} color={colors.text.disabled} />
                                <Text style={styles.metaText} numberOfLines={1}>{item.clinic.address}</Text>
                            </View>
                            {fee != null && (
                                <View style={styles.metaItem}>
                                    <DollarSign size={12} color={colors.secondary.DEFAULT} />
                                    <Text style={[styles.metaText, { color: colors.secondary.DEFAULT, fontWeight: '600' }]}>
                                        ฿{fee.toLocaleString()}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <ChevronRight size={18} color={colors.text.disabled} style={styles.arrow} />
                </TouchableOpacity>
                {filter === 'UPCOMING' && ['PENDING', 'CONFIRMED'].includes(item.status) && (
                    <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => handleCancel(item.id)}
                    >
                        <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Bookings</Text>
            </View>

            {/* Filter Tabs */}
            <View style={styles.tabs}>
                {(['UPCOMING', 'PAST', 'CANCELLED'] as Filter[]).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.tab, filter === f && styles.tabActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
                            {f === 'UPCOMING' ? 'Upcoming' : f === 'PAST' ? 'Past' : 'Cancelled'}
                        </Text>
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
                            onRefresh={() => { setIsRefreshing(true); fetchBookings(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Calendar size={44} color={colors.border.DEFAULT} />
                            <Text style={styles.emptyTitle}>No {filter.toLowerCase()} bookings</Text>
                            <Text style={styles.emptyDesc}>
                                {filter === 'UPCOMING'
                                    ? 'Find a clinic and book your first appointment!'
                                    : 'No bookings to show here.'}
                            </Text>
                            {filter === 'UPCOMING' && (
                                <TouchableOpacity
                                    style={styles.findBtn}
                                    onPress={() => router.push('/(app)/home' as any)}
                                >
                                    <Text style={styles.findBtnText}>Find Clinics →</Text>
                                </TouchableOpacity>
                            )}
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
        paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    headerTitle: { fontSize: 26, fontWeight: 'bold', color: colors.text.primary },
    tabs: {
        flexDirection: 'row',
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    tab: {
        flex: 1, paddingVertical: spacing.md, alignItems: 'center',
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.primary.DEFAULT },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
    tabTextActive: { color: colors.primary.DEFAULT },
    listContent: { padding: spacing.md, paddingBottom: 80 },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm,
    },
    cardLeft: { marginRight: spacing.md },
    clinicImg: { width: 60, height: 60, borderRadius: borderRadii.md },
    clinicImgPlaceholder: { backgroundColor: colors.border.light },
    cardInfo: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    clinicName: { fontSize: 15, fontWeight: '700', color: colors.text.primary, flex: 1, marginRight: spacing.xs },
    statusPill: { borderRadius: borderRadii.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    statusText: { fontSize: 10, fontWeight: '700' },
    serviceName: { fontSize: 12, color: colors.text.secondary, marginBottom: spacing.xs },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 11, color: colors.text.disabled },
    arrow: { marginLeft: spacing.sm },
    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xl },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    emptyDesc: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
    findBtn: { marginTop: spacing.xl },
    findBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary.DEFAULT },
    cancelBtn: {
        marginHorizontal: spacing.xs,
        marginBottom: spacing.sm,
        marginTop: -spacing.xs,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.semantic.error + '60',
        borderTopWidth: 0,
        borderBottomLeftRadius: borderRadii.lg,
        borderBottomRightRadius: borderRadii.lg,
        backgroundColor: '#FFF5F5',
    },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: colors.semantic.error },
});

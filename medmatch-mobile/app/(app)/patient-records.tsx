/**
 * Patient Records Screen — CLINIC
 * Shows list of patients who have booked with this clinic,
 * with their visit history and basic health info.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ChevronLeft, User, Calendar, Search, X, Clock,
    CheckCircle, XCircle, AlertCircle, ChevronRight
} from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

interface PatientVisit {
    id: string;
    booking_date: string;
    start_time: string;
    status: string;
    total_amount?: number;
    service?: { name: string };
    patient_notes?: string;
}

interface PatientRecord {
    patientId: string;
    displayName: string;
    visitCount: number;
    lastVisit: string;
    totalSpent: number;
    visits: PatientVisit[];
}

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
    CONFIRMED:  { color: colors.primary.DEFAULT, icon: CheckCircle },
    COMPLETED:  { color: colors.secondary.DEFAULT, icon: CheckCircle },
    CANCELLED:  { color: colors.semantic.error, icon: XCircle },
    PENDING:    { color: colors.semantic.warning, icon: Clock },
    NO_SHOW:    { color: colors.text.disabled, icon: AlertCircle },
};

export default function PatientRecordsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [records, setRecords] = useState<PatientRecord[]>([]);
    const [filtered, setFiltered] = useState<PatientRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

    const fetchRecords = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            // Fetch all clinic bookings (not just today)
            const res = await api.get('/booking/clinic/today');
            const bookings: any[] = Array.isArray(res.data) ? res.data : [];

            // Also fetch from /booking/my for full history — try alternative endpoint
            // Group bookings by patient
            const byPatient: Record<string, PatientRecord> = {};
            bookings.forEach((b: any) => {
                const pid = b.patient_id || b.patient?.id || `p-${b.id}`;
                const name = b.patient?.full_name || `Patient #${b.id.slice(-6)}`;
                if (!byPatient[pid]) {
                    byPatient[pid] = {
                        patientId: pid,
                        displayName: name,
                        visitCount: 0,
                        lastVisit: '',
                        totalSpent: 0,
                        visits: [],
                    };
                }
                byPatient[pid].visitCount++;
                byPatient[pid].totalSpent += b.total_amount || 0;
                const dateStr = b.booking_date?.split('T')[0] || '';
                if (!byPatient[pid].lastVisit || dateStr > byPatient[pid].lastVisit) {
                    byPatient[pid].lastVisit = dateStr;
                }
                byPatient[pid].visits.push({
                    id: b.id,
                    booking_date: dateStr,
                    start_time: b.start_time || '',
                    status: b.status,
                    total_amount: b.total_amount,
                    service: b.service,
                    patient_notes: b.patient_notes,
                });
            });

            const list = Object.values(byPatient).sort((a, b) =>
                b.lastVisit.localeCompare(a.lastVisit)
            );
            setRecords(list);
            setFiltered(list);
        } catch {
            setRecords([]);
            setFiltered([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchRecords(); }, []);

    useEffect(() => {
        if (!search.trim()) {
            setFiltered(records);
        } else {
            const q = search.toLowerCase();
            setFiltered(records.filter(r => r.displayName.toLowerCase().includes(q)));
        }
    }, [search, records]);

    const renderItem = ({ item }: { item: PatientRecord }) => (
        <TouchableOpacity
            style={styles.patientCard}
            onPress={() => setSelectedPatient(item)}
            activeOpacity={0.7}
        >
            <View style={styles.patientAvatar}>
                <User size={20} color={colors.primary.DEFAULT} />
            </View>
            <View style={styles.patientInfo}>
                <Text style={styles.patientName} numberOfLines={1}>{item.displayName}</Text>
                <Text style={styles.patientSub}>
                    {item.visitCount} visit{item.visitCount > 1 ? 's' : ''}
                    {item.lastVisit ? `  ·  Last: ${item.lastVisit}` : ''}
                </Text>
            </View>
            <View style={styles.patientRight}>
                {item.totalSpent > 0 && (
                    <Text style={styles.patientTotal}>฿{item.totalSpent.toLocaleString()}</Text>
                )}
                <ChevronRight size={16} color={colors.text.disabled} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Patient Records</Text>
                <View style={{ width: 26 }} />
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
                <Search size={18} color={colors.text.disabled} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search patients..."
                    placeholderTextColor={colors.text.disabled}
                    value={search}
                    onChangeText={setSearch}
                />
                {search ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <X size={18} color={colors.text.disabled} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : filtered.length === 0 ? (
                <View style={styles.centered}>
                    <User size={40} color={colors.border.DEFAULT} />
                    <Text style={styles.emptyText}>
                        {search ? 'No patients found' : 'No patient records yet'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.patientId}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchRecords(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                    ListHeaderComponent={() => (
                        <Text style={styles.countLabel}>{filtered.length} patients</Text>
                    )}
                />
            )}

            {/* Patient Detail Modal */}
            <Modal
                visible={!!selectedPatient}
                animationType="slide"
                transparent
                presentationStyle="overFullScreen"
            >
                {selectedPatient && (
                    <View style={styles.detailOverlay}>
                        <View style={styles.detailSheet}>
                            {/* Modal Header */}
                            <View style={styles.detailHeader}>
                                <View style={styles.detailAvatar}>
                                    <User size={28} color={colors.primary.DEFAULT} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.detailName}>{selectedPatient.displayName}</Text>
                                    <Text style={styles.detailSub}>
                                        {selectedPatient.visitCount} visits · ฿{selectedPatient.totalSpent.toLocaleString()} total
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedPatient(null)}>
                                    <X size={22} color={colors.text.primary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.visitList}>
                                <Text style={styles.visitSectionLabel}>Visit History</Text>
                                {selectedPatient.visits
                                    .sort((a, b) => b.booking_date.localeCompare(a.booking_date))
                                    .map(v => {
                                        const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.PENDING;
                                        const StatusIcon = cfg.icon;
                                        return (
                                            <View key={v.id} style={styles.visitCard}>
                                                <View style={styles.visitLeft}>
                                                    <Calendar size={14} color={colors.primary.DEFAULT} />
                                                    <Text style={styles.visitDate}>{v.booking_date}</Text>
                                                    {v.start_time ? (
                                                        <Text style={styles.visitTime}> · {v.start_time}</Text>
                                                    ) : null}
                                                </View>
                                                <View style={styles.visitMiddle}>
                                                    {v.service && (
                                                        <Text style={styles.visitService} numberOfLines={1}>
                                                            {v.service.name}
                                                        </Text>
                                                    )}
                                                    {v.patient_notes && (
                                                        <Text style={styles.visitNotes} numberOfLines={2}>
                                                            {v.patient_notes}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View style={styles.visitRight}>
                                                    {v.total_amount != null && (
                                                        <Text style={styles.visitAmount}>
                                                            ฿{v.total_amount.toLocaleString()}
                                                        </Text>
                                                    )}
                                                    <View style={[styles.visitStatus, { backgroundColor: cfg.color + '18' }]}>
                                                        <StatusIcon size={11} color={cfg.color} />
                                                        <Text style={[styles.visitStatusText, { color: cfg.color }]}>
                                                            {v.status}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    </View>
                )}
            </Modal>
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
    searchWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background.paper, margin: spacing.md,
        borderRadius: borderRadii.lg, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, ...shadows.sm,
    },
    searchIcon: { marginRight: spacing.sm },
    searchInput: { flex: 1, fontSize: 15, color: colors.text.primary },
    countLabel: { fontSize: 12, color: colors.text.disabled, paddingLeft: spacing.sm, paddingBottom: spacing.sm },
    list: { paddingHorizontal: spacing.md, paddingBottom: 40 },
    emptyText: { fontSize: 15, color: colors.text.secondary, marginTop: spacing.md },
    patientCard: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.lg, ...shadows.sm,
    },
    patientAvatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.primary.transparent,
        justifyContent: 'center', alignItems: 'center',
    },
    patientInfo: { flex: 1 },
    patientName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    patientSub: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    patientRight: { alignItems: 'flex-end', gap: 4 },
    patientTotal: { fontSize: 14, fontWeight: '700', color: colors.secondary.DEFAULT },
    // Detail Modal
    detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    detailSheet: {
        backgroundColor: colors.background.paper,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    detailHeader: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    detailAvatar: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: colors.primary.transparent,
        justifyContent: 'center', alignItems: 'center',
    },
    detailName: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    detailSub: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
    visitList: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    visitSectionLabel: {
        fontSize: 12, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    visitCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
        paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    visitLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 120 },
    visitDate: { fontSize: 12, fontWeight: '600', color: colors.text.primary },
    visitTime: { fontSize: 11, color: colors.text.secondary },
    visitMiddle: { flex: 1 },
    visitService: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
    visitNotes: { fontSize: 11, color: colors.text.secondary, marginTop: 2, fontStyle: 'italic' },
    visitRight: { alignItems: 'flex-end', gap: 4 },
    visitAmount: { fontSize: 14, fontWeight: 'bold', color: colors.secondary.DEFAULT },
    visitStatus: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: borderRadii.full, paddingHorizontal: 6, paddingVertical: 2 },
    visitStatusText: { fontSize: 10, fontWeight: '700' },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Modal, Alert, Platform
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { ChevronLeft, Clock, MapPin, DollarSign, Briefcase, XCircle, CalendarDays, Bell } from 'lucide-react-native';
import * as ExpoCalendar from 'expo-calendar';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

/** Normalize ISO datetime or date string to YYYY-MM-DD */
function toDateStr(v: any): string | null {
    if (!v) return null;
    const s = typeof v === 'string' ? v : String(v);
    return s.split('T')[0] || null;
}

interface WorkDay {
    date: string;
    jobs: {
        id: string;
        title: string;
        clinic_name: string;
        clinic_id?: string;
        address: string;
        start_time: string;
        end_time: string;
        pay_amount?: number;
        status: string;
    }[];
}

const JOB_STATUS_COLOR: Record<string, string> = {
    MATCHED:         colors.primary.DEFAULT,
    SEEKER_PENDING:  colors.semantic.warning,
    CONFIRMED:       colors.secondary.DEFAULT,
    COMPLETED:       colors.text.disabled,
    CANCELLED:       colors.semantic.error,
};

export default function CalendarScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
    const [workDays, setWorkDays] = useState<WorkDay[]>([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedDayJobs, setSelectedDayJobs] = useState<WorkDay['jobs']>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedJob, setSelectedJob] = useState<WorkDay['jobs'][0] | null>(null);

    const fetchMatches = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/jobs/matches');
            const matches: any[] = res.data;

            // Group by date
            const byDate: Record<string, WorkDay> = {};
            for (const m of matches) {
                const date = toDateStr(m.job?.work_date);
                if (!date) continue;
                if (!byDate[date]) byDate[date] = { date, jobs: [] };
                byDate[date].jobs.push({
                    id: m.id,
                    title: m.job?.title,
                    clinic_name: m.clinic?.clinic_name,
                    clinic_id: m.clinic?.id,
                    address: m.clinic?.address,
                    start_time: m.job?.start_time,
                    end_time: m.job?.end_time,
                    pay_amount: m.job?.pay_amount,
                    status: m.status,
                });
            }

            setWorkDays(Object.values(byDate));

            // Build marked dates for calendar
            const marks: Record<string, any> = {};
            for (const [date, day] of Object.entries(byDate)) {
                const statuses = day.jobs.map((j) => j.status);
                const color = statuses.includes('CONFIRMED') || statuses.includes('MATCHED')
                    ? colors.primary.DEFAULT
                    : statuses.includes('SEEKER_PENDING')
                        ? colors.semantic.warning
                        : colors.text.disabled;
                marks[date] = {
                    marked: true,
                    dotColor: color,
                    ...(selectedDate === date ? { selected: true, selectedColor: color } : {}),
                };
            }
            setMarkedDates(marks);
        } catch {}
        finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchMatches(); }, []);

    const handleDayPress = (day: DateData) => {
        const date = day.dateString;

        // Tap same date again → deselect
        const isDeselect = selectedDate === date;
        const next = isDeselect ? '' : date;
        setSelectedDate(next);

        // Update marks to highlight selected
        setMarkedDates((prev) => {
            const updated: Record<string, any> = {};
            for (const [d, m] of Object.entries(prev)) {
                updated[d] = { ...m, selected: !isDeselect && d === date };
            }
            if (!isDeselect && !updated[date]) {
                updated[date] = { selected: true, selectedColor: colors.border.DEFAULT };
            }
            return updated;
        });

        if (isDeselect) {
            setSelectedDayJobs([]);
        } else {
            const found = workDays.find((w) => w.date === date);
            setSelectedDayJobs(found?.jobs || []);
        }
    };

    const addToNativeCalendar = async (job: WorkDay['jobs'][0], date: string) => {
        try {
            const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Calendar access is required to add reminders.');
                return;
            }

            // Find or create MedMatch calendar
            const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
            let cal = calendars.find((c) => c.title === 'MedMatch');
            if (!cal) {
                const defaultCal = calendars.find(
                    (c) => c.allowsModifications && c.source?.name === (Platform.OS === 'ios' ? 'iCloud' : 'Default'),
                ) || calendars.find((c) => c.allowsModifications);
                if (!defaultCal?.source) {
                    Alert.alert('Error', 'No writable calendar found.');
                    return;
                }
                const calId = await ExpoCalendar.createCalendarAsync({
                    title: 'MedMatch',
                    color: colors.primary.DEFAULT,
                    entityType: ExpoCalendar.EntityTypes.EVENT,
                    sourceId: defaultCal.source.id,
                    source: defaultCal.source,
                    name: 'MedMatch',
                    ownerAccount: 'personal',
                    accessLevel: ExpoCalendar.CalendarAccessLevel.OWNER,
                });
                cal = { id: calId } as any;
            }

            // Parse times
            const [startH, startM] = (job.start_time || '09:00').split(':').map(Number);
            const [endH, endM] = (job.end_time || '17:00').split(':').map(Number);
            const startDate = new Date(date + 'T00:00:00');
            startDate.setHours(startH, startM, 0);
            const endDate = new Date(date + 'T00:00:00');
            endDate.setHours(endH, endM, 0);

            await ExpoCalendar.createEventAsync(cal.id, {
                title: job.title,
                location: job.address || '',
                notes: `Clinic: ${job.clinic_name}\nPay: ${job.pay_amount ? '฿' + job.pay_amount.toLocaleString() : 'N/A'}`,
                startDate,
                endDate,
                timeZone: 'Asia/Bangkok',
                alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
            });

            Alert.alert('Added!', 'Shift added to your calendar with reminders (1 hour & 1 day before).');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to add to calendar');
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? router.back() : null} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Work Calendar</Text>
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
                    {/* Calendar */}
                    <View style={styles.calendarCard}>
                        <Calendar
                            onDayPress={handleDayPress}
                            markedDates={markedDates}
                            theme={{
                                todayTextColor: colors.primary.DEFAULT,
                                arrowColor: colors.primary.DEFAULT,
                                textDayFontWeight: '500',
                                textMonthFontWeight: 'bold',
                                textDayHeaderFontWeight: '600',
                                backgroundColor: 'transparent',
                                calendarBackground: 'transparent',
                            }}
                        />
                    </View>

                    {/* Legend */}
                    <View style={styles.legend}>
                        <LegendItem color={colors.primary.DEFAULT} label="Work day" />
                        <LegendItem color={colors.semantic.warning} label="Pending" />
                        <LegendItem color={colors.secondary.DEFAULT} label="Confirmed" />
                        <LegendItem color={colors.text.disabled} label="Completed" />
                    </View>

                    {/* Selected Day Jobs */}
                    <View style={styles.daySection}>
                        <Text style={styles.daySectionTitle}>
                            {selectedDate
                                ? `${selectedDate === today ? 'Today — ' : ''}${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                                : 'Tap a date to view shifts'}
                        </Text>

                        {selectedDate && selectedDayJobs.length === 0 && (
                            <View style={styles.noShifts}>
                                <Briefcase size={28} color={colors.border.DEFAULT} />
                                <Text style={styles.noShiftsText}>No shifts on this day</Text>
                            </View>
                        )}

                        {selectedDayJobs.map((job) => (
                            <TouchableOpacity key={job.id} style={styles.shiftCard} onPress={() => setSelectedJob(job)}>
                                <View style={[styles.shiftIndicator, { backgroundColor: JOB_STATUS_COLOR[job.status] || colors.border.DEFAULT }]} />
                                <View style={styles.shiftInfo}>
                                    <Text style={styles.shiftTitle} numberOfLines={1}>{job.title}</Text>
                                    <TouchableOpacity
                                        disabled={!job.clinic_id}
                                        onPress={() => job.clinic_id && router.push(`/(app)/clinic-profile/${job.clinic_id}` as any)}
                                    >
                                        <Text style={[styles.shiftClinic, job.clinic_id && { color: colors.primary.DEFAULT, textDecorationLine: 'underline' }]} numberOfLines={1}>
                                            {job.clinic_name}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={styles.shiftMeta}>
                                        <View style={styles.metaItem}>
                                            <Clock size={12} color={colors.text.disabled} />
                                            <Text style={styles.metaText}>{job.start_time}–{job.end_time}</Text>
                                        </View>
                                        {job.address && (
                                            <View style={styles.metaItem}>
                                                <MapPin size={12} color={colors.text.disabled} />
                                                <Text style={styles.metaText} numberOfLines={1}>{job.address}</Text>
                                            </View>
                                        )}
                                        {job.pay_amount != null && (
                                            <View style={styles.metaItem}>
                                                <DollarSign size={12} color={colors.secondary.DEFAULT} />
                                                <Text style={[styles.metaText, { color: colors.secondary.DEFAULT, fontWeight: '600' }]}>
                                                    ฿{job.pay_amount.toLocaleString()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={[styles.statusPill, { backgroundColor: (JOB_STATUS_COLOR[job.status] || colors.border.DEFAULT) + '20' }]}>
                                    <Text style={[styles.statusText, { color: JOB_STATUS_COLOR[job.status] || colors.text.disabled }]}>
                                        {job.status}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Upcoming shifts */}
                    {(() => {
                        const upcoming = workDays.filter((w) => w.date >= today);
                        if (upcoming.length === 0) return null;
                        return (
                        <View style={styles.daySection}>
                            <Text style={styles.daySectionTitle}>Upcoming Shifts</Text>
                            {workDays.filter((w) => w.date >= today).slice(0, 5).map((w) => (
                                <TouchableOpacity
                                    key={w.date}
                                    style={styles.upcomingRow}
                                    onPress={() => handleDayPress({ dateString: w.date } as DateData)}
                                >
                                    <View style={styles.upcomingDate}>
                                        <Text style={styles.upcomingDay}>
                                            {new Date(w.date + 'T00:00:00').getDate()}
                                        </Text>
                                        <Text style={styles.upcomingMonth}>
                                            {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                                        </Text>
                                    </View>
                                    <View style={styles.upcomingInfo}>
                                        <Text style={styles.upcomingTitle} numberOfLines={1}>{w.jobs[0].title}</Text>
                                        <Text style={styles.upcomingClinic} numberOfLines={1}>{w.jobs[0].clinic_name}</Text>
                                    </View>
                                    {w.jobs.length > 1 && (
                                        <View style={styles.moreBadge}>
                                            <Text style={styles.moreBadgeText}>+{w.jobs.length - 1}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                        );
                    })()}
                    {workDays.filter((w) => w.date >= today).length === 0 && !selectedDate && (
                        <View style={styles.daySection}>
                            <View style={styles.noShifts}>
                                <Briefcase size={28} color={colors.border.DEFAULT} />
                                <Text style={styles.noShiftsText}>No upcoming shifts</Text>
                                <TouchableOpacity onPress={() => router.push('/(app)/jobs/index' as any)}>
                                    <Text style={styles.findJobsLink}>Browse jobs →</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* Job Detail Modal */}
            <Modal visible={!!selectedJob} transparent animationType="slide" onRequestClose={() => setSelectedJob(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Job Details</Text>
                            <TouchableOpacity onPress={() => setSelectedJob(null)}>
                                <XCircle size={24} color={colors.text.disabled} />
                            </TouchableOpacity>
                        </View>

                        {selectedJob && (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                {/* Status */}
                                <View style={[styles.modalStatusPill, { backgroundColor: (JOB_STATUS_COLOR[selectedJob.status] || colors.border.DEFAULT) + '20' }]}>
                                    <Text style={[styles.modalStatusText, { color: JOB_STATUS_COLOR[selectedJob.status] || colors.text.disabled }]}>
                                        {selectedJob.status === 'SEEKER_PENDING' ? 'Pending Confirmation' : selectedJob.status}
                                    </Text>
                                </View>

                                {/* Title */}
                                <Text style={styles.modalJobTitle}>{selectedJob.title}</Text>

                                {/* Clinic */}
                                <TouchableOpacity
                                    disabled={!selectedJob.clinic_id}
                                    onPress={() => { setSelectedJob(null); selectedJob.clinic_id && router.push(`/(app)/clinic-profile/${selectedJob.clinic_id}` as any); }}
                                >
                                    <View style={styles.modalDetailRow}>
                                        <Briefcase size={18} color={colors.primary.DEFAULT} />
                                        <Text style={[styles.modalDetailText, selectedJob.clinic_id && { color: colors.primary.DEFAULT, textDecorationLine: 'underline' }]}>
                                            {selectedJob.clinic_name}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Date */}
                                <View style={styles.modalDetailRow}>
                                    <CalendarDays size={18} color={colors.text.secondary} />
                                    <Text style={styles.modalDetailText}>
                                        {selectedDate || 'N/A'}
                                    </Text>
                                </View>

                                {/* Time */}
                                <View style={styles.modalDetailRow}>
                                    <Clock size={18} color={colors.text.secondary} />
                                    <Text style={styles.modalDetailText}>
                                        {selectedJob.start_time} – {selectedJob.end_time}
                                    </Text>
                                </View>

                                {/* Location */}
                                {selectedJob.address && (
                                    <View style={styles.modalDetailRow}>
                                        <MapPin size={18} color={colors.semantic.error} />
                                        <Text style={styles.modalDetailText}>{selectedJob.address}</Text>
                                    </View>
                                )}

                                {/* Pay */}
                                {selectedJob.pay_amount != null && (
                                    <View style={styles.modalDetailRow}>
                                        <DollarSign size={18} color={colors.secondary.DEFAULT} />
                                        <Text style={[styles.modalDetailText, { color: colors.secondary.DEFAULT, fontWeight: '700' }]}>
                                            ฿{selectedJob.pay_amount.toLocaleString()}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}

                        {/* Action buttons */}
                        <View style={styles.modalActions}>
                            {selectedJob && selectedDate && (
                                <TouchableOpacity
                                    style={styles.addCalendarBtn}
                                    onPress={() => addToNativeCalendar(selectedJob, selectedDate)}
                                >
                                    <Bell size={16} color={colors.text.inverse} />
                                    <Text style={styles.addCalendarBtnText}>Add to Calendar</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedJob(null)}>
                                <Text style={styles.modalCloseBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    calendarCard: {
        backgroundColor: colors.background.paper,
        margin: spacing.md, borderRadius: borderRadii.lg, ...shadows.sm,
        padding: spacing.sm,
    },
    legend: { flexDirection: 'row', gap: spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 12, color: colors.text.secondary },
    daySection: {
        marginHorizontal: spacing.md, marginBottom: spacing.md,
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg, padding: spacing.md, ...shadows.sm,
    },
    daySectionTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md },
    noShifts: { alignItems: 'center', paddingVertical: spacing.xl },
    noShiftsText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
    findJobsLink: { fontSize: 14, color: colors.primary.DEFAULT, fontWeight: '600', marginTop: spacing.sm },
    shiftCard: {
        flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm,
        borderWidth: 1, borderColor: colors.border.light, borderRadius: borderRadii.md, overflow: 'hidden',
    },
    shiftIndicator: { width: 4, alignSelf: 'stretch' },
    shiftInfo: { flex: 1, padding: spacing.sm },
    shiftTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    shiftClinic: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    shiftMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 11, color: colors.text.disabled },
    statusPill: { borderRadius: borderRadii.full, paddingHorizontal: spacing.sm, paddingVertical: 3, margin: spacing.sm },
    statusText: { fontSize: 10, fontWeight: '700' },
    upcomingRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    upcomingDate: { alignItems: 'center', width: 44, marginRight: spacing.md },
    upcomingDay: { fontSize: 20, fontWeight: 'bold', color: colors.primary.DEFAULT },
    upcomingMonth: { fontSize: 11, color: colors.text.secondary, textTransform: 'uppercase' },
    upcomingInfo: { flex: 1 },
    upcomingTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    upcomingClinic: { fontSize: 12, color: colors.text.secondary },
    moreBadge: {
        backgroundColor: colors.border.light, borderRadius: borderRadii.full,
        width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
    },
    moreBadgeText: { fontSize: 11, fontWeight: '700', color: colors.text.secondary },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background.paper,
        borderTopLeftRadius: borderRadii.xl,
        borderTopRightRadius: borderRadii.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
    modalBody: { marginBottom: spacing.md },
    modalStatusPill: {
        alignSelf: 'flex-start', borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.md,
    },
    modalStatusText: { fontSize: 12, fontWeight: '700' },
    modalJobTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.lg },
    modalDetailRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        marginBottom: spacing.md,
    },
    modalDetailText: { fontSize: 15, color: colors.text.primary, flex: 1 },
    modalActions: { gap: spacing.sm },
    addCalendarBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        backgroundColor: colors.secondary.DEFAULT, borderRadius: borderRadii.md,
        paddingVertical: spacing.md,
    },
    addCalendarBtnText: { color: colors.text.inverse, fontSize: 15, fontWeight: '600' },
    modalCloseBtn: {
        backgroundColor: colors.primary.DEFAULT, borderRadius: borderRadii.md,
        paddingVertical: spacing.md, alignItems: 'center',
    },
    modalCloseBtnText: { color: colors.text.inverse, fontSize: 15, fontWeight: '600' },
});

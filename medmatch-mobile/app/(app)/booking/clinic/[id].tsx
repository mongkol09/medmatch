import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { MapPin, Star, Clock, Info, ChevronLeft, CheckCircle } from 'lucide-react-native';
import { Button } from '../../../../src/components/common/Button';
import { colors, spacing, borderRadii, shadows } from '../../../../src/theme';
import { api, resolveImageUrl } from '../../../../src/services/api';

interface ClinicService {
    id: string;
    name: string;
    price?: number;
    duration_minutes: number;
    description?: string;
}

interface TimeSlot {
    id: string;
    time: string;
    available: boolean;
}

interface ClinicDetail {
    id: string;
    clinic_name: string;
    address: string;
    average_rating?: number;
    review_count?: number;
    description?: string;
    images?: string[];
    consultation_fee?: number;
}

export default function ClinicBookingScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [clinic, setClinic] = useState<ClinicDetail | null>(null);
    const [slots, setSlots] = useState<TimeSlot[]>([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSlotsLoading, setIsSlotsLoading] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [note, setNote] = useState('');
    const [services, setServices] = useState<ClinicService[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewRating, setReviewRating] = useState(0);

    useEffect(() => {
        fetchClinic();
    }, [id]);

    useEffect(() => { fetchReviews(); }, [id]);

    const fetchClinic = async () => {
        try {
            const [clinicRes, servicesRes] = await Promise.allSettled([
                api.get(`/profile/clinic/${id}`),
                api.get('/booking/services', { params: { clinicId: id } }),
            ]);
            if (clinicRes.status === 'fulfilled') setClinic(clinicRes.value.data);
            if (servicesRes.status === 'fulfilled') setServices(servicesRes.value.data || []);
            if (clinicRes.status === 'rejected') {
                Alert.alert('Error', 'Failed to load clinic details.', [
                    { text: 'Go Back', onPress: () => router.back() },
                ]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const fetchReviews = async () => {
        try {
            const res = await api.get(`/reviews/clinic-profile/${id}`);
            setReviews(res.data.data || []);
            setReviewRating(res.data.rating_avg || 0);
        } catch {}
    };

    const fetchSlots = useCallback(async (date: string) => {
        setIsSlotsLoading(true);
        setSlots([]);
        try {
            const res = await api.get('/booking/available-slots', {
                params: { clinicId: id, date },
            });
            setSlots(res.data);
        } catch {
            setSlots([]);
        } finally {
            setIsSlotsLoading(false);
        }
    }, [id]);

    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString);
        setSelectedSlot(null);
        fetchSlots(day.dateString);
    };

    const handleBook = async () => {
        if (!selectedDate || !selectedSlot) {
            Alert.alert('Incomplete', 'Please select a date and a time slot.');
            return;
        }
        setIsBooking(true);
        try {
            const res = await api.post('/booking', {
                clinic_id: id,
                date: selectedDate,
                time_slot: selectedSlot,
                note,
                serviceId: selectedServiceId || undefined,
            });
            Alert.alert('Booked!', 'Your appointment has been confirmed.', [
                {
                    text: 'View Booking',
                    onPress: () => router.push(`/(app)/payment/${res.data.id}` as any),
                },
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Failed', err.response?.data?.message || 'Could not complete booking.');
        } finally {
            setIsBooking(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    if (!clinic) return null;

    const today = new Date().toISOString().split('T')[0];

    return (
        <View style={styles.container}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Hero Image */}
                {clinic.images?.[0] ? (
                    <Image source={{ uri: resolveImageUrl(clinic.images[0]) }} style={styles.headerImage} />
                ) : (
                    <View style={[styles.headerImage, styles.headerPlaceholder]} />
                )}

                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <View style={styles.backCircle}>
                        <ChevronLeft size={22} color={colors.text.primary} />
                    </View>
                </TouchableOpacity>

                <View style={styles.content}>
                    {/* Clinic Header */}
                    <Text style={styles.clinicName}>{clinic.clinic_name}</Text>

                    <View style={styles.metaRow}>
                        {clinic.average_rating != null && (
                            <View style={styles.metaItem}>
                                <Star size={14} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                <Text style={styles.metaText}>
                                    {clinic.average_rating.toFixed(1)}
                                    {clinic.review_count ? ` (${clinic.review_count})` : ''}
                                </Text>
                            </View>
                        )}
                        {clinic.address && (
                            <View style={[styles.metaItem, { flex: 1 }]}>
                                <MapPin size={14} color={colors.text.secondary} />
                                <Text style={styles.metaText} numberOfLines={1}>{clinic.address}</Text>
                            </View>
                        )}
                    </View>

                    {clinic.description && (
                        <View style={styles.descriptionBox}>
                            <Info size={15} color={colors.primary.DEFAULT} style={{ marginTop: 1 }} />
                            <Text style={styles.descriptionText}>{clinic.description}</Text>
                        </View>
                    )}

                    {/* Service Selection */}
                    {services.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Select Service</Text>
                            <View style={styles.serviceList}>
                                {services.map(svc => (
                                    <TouchableOpacity
                                        key={svc.id}
                                        style={[styles.serviceItem, selectedServiceId === svc.id && styles.serviceItemSelected]}
                                        onPress={() => setSelectedServiceId(svc.id)}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.serviceName, selectedServiceId === svc.id && styles.serviceNameSelected]}>
                                                {svc.name}
                                            </Text>
                                            <Text style={styles.serviceMeta}>
                                                {svc.duration_minutes} min
                                                {svc.description ? `  ·  ${svc.description}` : ''}
                                            </Text>
                                        </View>
                                        {svc.price != null && (
                                            <Text style={[styles.servicePrice, selectedServiceId === svc.id && styles.servicePriceSelected]}>
                                                ฿{svc.price.toLocaleString()}
                                            </Text>
                                        )}
                                        {selectedServiceId === svc.id && (
                                            <CheckCircle size={18} color={colors.primary.DEFAULT} style={{ marginLeft: 8 }} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Calendar */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Date</Text>
                        <View style={styles.calendarCard}>
                            <Calendar
                                onDayPress={handleDayPress}
                                minDate={today}
                                markedDates={{
                                    [selectedDate]: { selected: true, selectedColor: colors.primary.DEFAULT },
                                }}
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
                    </View>

                    {/* Time Slots */}
                    {selectedDate !== '' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Available Slots</Text>
                            {isSlotsLoading ? (
                                <ActivityIndicator color={colors.primary.DEFAULT} />
                            ) : slots.length === 0 ? (
                                <View style={styles.noSlotsBox}>
                                    <Clock size={24} color={colors.border.DEFAULT} />
                                    <Text style={styles.noSlotsText}>No slots available on this date</Text>
                                </View>
                            ) : (
                                <View style={styles.slotsGrid}>
                                    {slots.map((slot) => (
                                        <TouchableOpacity
                                            key={slot.id}
                                            disabled={!slot.available}
                                            style={[
                                                styles.slotButton,
                                                !slot.available && styles.slotDisabled,
                                                selectedSlot === slot.time && styles.slotSelected,
                                            ]}
                                            onPress={() => setSelectedSlot(slot.time)}
                                        >
                                            <Clock
                                                size={13}
                                                color={
                                                    !slot.available
                                                        ? colors.text.disabled
                                                        : selectedSlot === slot.time
                                                        ? colors.text.inverse
                                                        : colors.primary.DEFAULT
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.slotText,
                                                    !slot.available && styles.slotTextDisabled,
                                                    selectedSlot === slot.time && styles.slotTextSelected,
                                                ]}
                                            >
                                                {slot.time}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Reviews */}
                    {reviews.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.reviewHeader}>
                                <Text style={styles.sectionTitle}>Reviews</Text>
                                <View style={styles.reviewRatingBig}>
                                    <Star size={16} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                    <Text style={styles.reviewRatingText}>{reviewRating.toFixed(1)}</Text>
                                    <Text style={styles.reviewCountText}>({reviews.length})</Text>
                                </View>
                            </View>
                            {reviews.slice(0, 5).map(r => (
                                <View key={r.id} style={styles.reviewCard}>
                                    <View style={styles.reviewCardTop}>
                                        <View style={styles.reviewStars}>
                                            {[1,2,3,4,5].map(n => (
                                                <Star key={n} size={12}
                                                    fill={n <= r.rating ? colors.semantic.warning : 'transparent'}
                                                    color={colors.semantic.warning} />
                                            ))}
                                        </View>
                                        <Text style={styles.reviewDate}>
                                            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>
                                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ height: 120 }} />
                </View>
            </ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.feeContainer}>
                    <Text style={styles.feeLabel}>Consultation fee</Text>
                    <Text style={styles.feeValue}>
                        {clinic.consultation_fee ? `฿${clinic.consultation_fee.toLocaleString()}` : '~฿500'}
                    </Text>
                </View>
                <Button
                    title="Book Now"
                    onPress={handleBook}
                    isLoading={isBooking}
                    style={styles.bookBtn}
                    disabled={!selectedDate || !selectedSlot}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerImage: { width: '100%', height: 240 },
    headerPlaceholder: { backgroundColor: colors.border.light },
    backButton: { position: 'absolute', top: 52, left: spacing.md },
    backCircle: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.background.paper, justifyContent: 'center', alignItems: 'center',
        ...shadows.sm,
    },
    content: {
        flex: 1, padding: spacing.xl, marginTop: -20,
        backgroundColor: colors.background.DEFAULT,
        borderTopLeftRadius: borderRadii.xl, borderTopRightRadius: borderRadii.xl,
    },
    clinicName: { fontSize: 22, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: colors.text.secondary },
    descriptionBox: {
        flexDirection: 'row', gap: spacing.sm,
        backgroundColor: colors.primary.transparent, padding: spacing.md,
        borderRadius: borderRadii.md, marginBottom: spacing.xl,
    },
    descriptionText: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 20 },
    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md },
    calendarCard: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.sm, ...shadows.sm,
    },
    noSlotsBox: { alignItems: 'center', paddingVertical: spacing.xl },
    noSlotsText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    slotButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: '31%', backgroundColor: colors.background.paper,
        paddingVertical: spacing.md, borderRadius: borderRadii.md,
        borderWidth: 1.5, borderColor: colors.primary.DEFAULT,
    },
    slotSelected: { backgroundColor: colors.primary.DEFAULT },
    slotDisabled: { backgroundColor: colors.background.DEFAULT, borderColor: colors.border.DEFAULT },
    slotText: { fontSize: 13, fontWeight: '600', color: colors.primary.DEFAULT },
    slotTextSelected: { color: colors.text.inverse },
    slotTextDisabled: { color: colors.text.disabled },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.background.paper,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 34,
        borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, ...shadows.lg,
    },
    feeContainer: { flex: 1 },
    feeLabel: { fontSize: 12, color: colors.text.secondary },
    feeValue: { fontSize: 20, fontWeight: 'bold', color: colors.text.primary },
    bookBtn: { width: 150 },
    serviceList: { gap: spacing.sm },
    serviceItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: spacing.md, borderRadius: borderRadii.md,
        borderWidth: 1.5, borderColor: colors.border.DEFAULT,
        backgroundColor: colors.background.paper,
    },
    serviceItemSelected: { borderColor: colors.primary.DEFAULT, backgroundColor: colors.primary.transparent },
    serviceName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    serviceNameSelected: { color: colors.primary.DEFAULT },
    serviceMeta: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    servicePrice: { fontSize: 15, fontWeight: 'bold', color: colors.text.primary },
    servicePriceSelected: { color: colors.primary.DEFAULT },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    reviewRatingBig: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    reviewRatingText: { fontSize: 16, fontWeight: 'bold', color: colors.text.primary },
    reviewCountText: { fontSize: 13, color: colors.text.secondary },
    reviewCard: {
        paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    reviewCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reviewStars: { flexDirection: 'row', gap: 2 },
    reviewDate: { fontSize: 11, color: colors.text.disabled },
    reviewComment: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
});

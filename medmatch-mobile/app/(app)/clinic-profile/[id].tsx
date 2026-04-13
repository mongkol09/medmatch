import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ChevronLeft, MapPin, Star, Clock, Phone, Info, Globe
} from 'lucide-react-native';
import { Button } from '../../../src/components/common/Button';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, resolveImageUrl } from '../../../src/services/api';

const { width } = Dimensions.get('window');

interface ClinicProfile {
    id: string;
    clinic_name: string;
    address: string;
    description?: string;
    images?: string[];
    consultation_fee?: number;
    average_rating?: number;
    review_count?: number;
    latitude?: number;
    longitude?: number;
    parking_info?: string;
}

export default function ClinicProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [clinic, setClinic] = useState<ClinicProfile | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [profileRes, reviewsRes, servicesRes] = await Promise.allSettled([
                    api.get(`/profile/clinic/${id}`),
                    api.get(`/reviews/clinic-profile/${id}`, { params: { limit: 5 } }),
                    api.get('/booking/services', { params: { clinicId: id } }),
                ]);
                if (profileRes.status === 'fulfilled') setClinic(profileRes.value.data);
                if (reviewsRes.status === 'fulfilled') setReviews(reviewsRes.value.data?.data || []);
                if (servicesRes.status === 'fulfilled') setServices(servicesRes.value.data || []);
            } catch {} finally { setIsLoading(false); }
        })();
    }, [id]);

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary.DEFAULT} /></View>;
    }
    if (!clinic) return null;

    return (
        <View style={styles.container}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                {clinic.images?.[0] ? (
                    <Image source={{ uri: resolveImageUrl(clinic.images[0]) }} style={styles.heroImage} />
                ) : (
                    <View style={[styles.heroImage, { backgroundColor: colors.border.light }]} />
                )}
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <View style={styles.backCircle}>
                        <ChevronLeft size={22} color={colors.text.primary} />
                    </View>
                </TouchableOpacity>

                <View style={styles.content}>
                    <Text style={styles.clinicName}>{clinic.clinic_name}</Text>

                    <View style={styles.metaRow}>
                        {clinic.average_rating != null && (
                            <View style={styles.metaItem}>
                                <Star size={14} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                <Text style={styles.metaText}>
                                    {clinic.average_rating.toFixed(1)} ({clinic.review_count || 0})
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
                        <View style={styles.descBox}>
                            <Info size={15} color={colors.primary.DEFAULT} style={{ marginTop: 1 }} />
                            <Text style={styles.descText}>{clinic.description}</Text>
                        </View>
                    )}

                    {/* Quick Info */}
                    <View style={styles.quickInfoRow}>
                        {clinic.consultation_fee != null && (
                            <View style={styles.quickInfoItem}>
                                <Text style={styles.quickInfoValue}>฿{clinic.consultation_fee.toLocaleString()}</Text>
                                <Text style={styles.quickInfoLabel}>Consultation</Text>
                            </View>
                        )}
                        {clinic.parking_info && (
                            <View style={styles.quickInfoItem}>
                                <Text style={styles.quickInfoValue}>Available</Text>
                                <Text style={styles.quickInfoLabel}>Parking</Text>
                            </View>
                        )}
                    </View>

                    {/* Services */}
                    {services.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Services</Text>
                            {services.map(svc => (
                                <View key={svc.id} style={styles.serviceRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.serviceName}>{svc.name}</Text>
                                        {svc.duration_minutes && (
                                            <Text style={styles.serviceDuration}>{svc.duration_minutes} min</Text>
                                        )}
                                    </View>
                                    {svc.price != null && (
                                        <Text style={styles.servicePrice}>฿{svc.price.toLocaleString()}</Text>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Reviews */}
                    {reviews.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Reviews</Text>
                            {reviews.map(r => (
                                <View key={r.id} style={styles.reviewCard}>
                                    <View style={styles.reviewTop}>
                                        <View style={styles.reviewStars}>
                                            {[1,2,3,4,5].map(n => (
                                                <Star key={n} size={12} fill={n <= r.rating ? colors.semantic.warning : 'transparent'} color={colors.semantic.warning} />
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

            {/* Book Button */}
            <View style={styles.bottomBar}>
                <Button
                    title="Book Appointment"
                    onPress={() => router.push(`/(app)/booking/clinic/${id}` as any)}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT },
    heroImage: { width, height: 220 },
    backButton: { position: 'absolute', top: 52, left: spacing.md },
    backCircle: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.background.paper, justifyContent: 'center', alignItems: 'center',
        ...shadows.sm,
    },
    content: {
        padding: spacing.xl, marginTop: -20,
        backgroundColor: colors.background.DEFAULT,
        borderTopLeftRadius: borderRadii.xl, borderTopRightRadius: borderRadii.xl,
    },
    clinicName: { fontSize: 24, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: colors.text.secondary },
    descBox: {
        flexDirection: 'row', gap: spacing.sm,
        backgroundColor: colors.primary.transparent, padding: spacing.md,
        borderRadius: borderRadii.md, marginBottom: spacing.lg,
    },
    descText: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 20 },
    quickInfoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    quickInfoItem: {
        flex: 1, backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, alignItems: 'center', ...shadows.sm,
    },
    quickInfoValue: { fontSize: 16, fontWeight: 'bold', color: colors.primary.DEFAULT },
    quickInfoLabel: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    serviceRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    serviceName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    serviceDuration: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    servicePrice: { fontSize: 15, fontWeight: 'bold', color: colors.primary.DEFAULT },
    reviewCard: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reviewStars: { flexDirection: 'row', gap: 2 },
    reviewDate: { fontSize: 11, color: colors.text.disabled },
    reviewComment: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.background.paper,
        paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 34,
        borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, ...shadows.lg,
    },
});

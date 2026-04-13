import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ChevronLeft, User, Star, Briefcase, Shield, CheckCircle, Award
} from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, resolveImageUrl } from '../../../src/services/api';

const SPECIALTY_LABELS: Record<string, string> = {
    DENTIST: 'ทันตแพทย์',
    DOCTOR: 'แพทย์ทั่วไป',
    PHARMACIST: 'เภสัชกร',
    NURSE: 'พยาบาล',
    DENTAL_ASSISTANT: 'ผู้ช่วยทันตแพทย์',
    PHYSIOTHERAPIST: 'นักกายภาพบำบัด',
    OTHER: 'อื่นๆ',
};

interface SeekerProfile {
    id: string;
    full_name: string;
    specialty: string;
    years_experience: number;
    bio?: string;
    specialties?: string[];
    average_rating?: number;
    review_count?: number;
    profile_image_url?: string;
    is_verified?: boolean;
}

export default function SeekerProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [profile, setProfile] = useState<SeekerProfile | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [profileRes, reviewsRes] = await Promise.allSettled([
                    api.get(`/profile/seeker/${id}`),
                    api.get(`/reviews/user/${id}`, { params: { limit: 5 } }),
                ]);
                if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                if (reviewsRes.status === 'fulfilled') setReviews(reviewsRes.value.data?.data || []);
            } catch {} finally { setIsLoading(false); }
        })();
    }, [id]);

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary.DEFAULT} /></View>;
    }
    if (!profile) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronLeft size={26} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Provider Profile</Text>
                    <View style={{ width: 26 }} />
                </View>
                <View style={styles.centered}>
                    <User size={48} color={colors.border.DEFAULT} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md }}>
                        Profile not found
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl }}>
                        This provider's profile may not be available yet.
                    </Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg, backgroundColor: colors.primary.DEFAULT, borderRadius: borderRadii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
                        <Text style={{ color: colors.text.inverse, fontWeight: '600' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Provider Profile</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarSection}>
                        {profile.profile_image_url ? (
                            <Image source={{ uri: resolveImageUrl(profile.profile_image_url) }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={40} color={colors.text.disabled} />
                            </View>
                        )}
                        {profile.is_verified && (
                            <View style={styles.verifiedBadge}>
                                <CheckCircle size={16} color={colors.background.paper} fill={colors.secondary.DEFAULT} />
                            </View>
                        )}
                    </View>

                    <Text style={styles.name}>{profile.full_name}</Text>

                    <View style={styles.specialtyBadge}>
                        <Text style={styles.specialtyText}>
                            {SPECIALTY_LABELS[profile.specialty] || profile.specialty}
                        </Text>
                    </View>

                    {profile.average_rating != null && (
                        <View style={styles.ratingRow}>
                            <Star size={16} fill={colors.semantic.warning} color={colors.semantic.warning} />
                            <Text style={styles.ratingText}>{profile.average_rating.toFixed(1)}</Text>
                            <Text style={styles.reviewCountText}>({profile.review_count || 0} reviews)</Text>
                        </View>
                    )}
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Briefcase size={20} color={colors.primary.DEFAULT} />
                        <Text style={styles.statValue}>{profile.years_experience || 0}</Text>
                        <Text style={styles.statLabel}>Years Exp.</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Star size={20} color={colors.semantic.warning} />
                        <Text style={styles.statValue}>{profile.average_rating?.toFixed(1) || '—'}</Text>
                        <Text style={styles.statLabel}>Rating</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Award size={20} color={colors.secondary.DEFAULT} />
                        <Text style={styles.statValue}>{profile.review_count || 0}</Text>
                        <Text style={styles.statLabel}>Reviews</Text>
                    </View>
                </View>

                {/* Bio */}
                {profile.bio && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.bioText}>{profile.bio}</Text>
                    </View>
                )}

                {/* Skills */}
                {profile.specialties && profile.specialties.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Skills & Specialties</Text>
                        <View style={styles.skillsRow}>
                            {profile.specialties.map((s, i) => (
                                <View key={i} style={styles.skillChip}>
                                    <Text style={styles.skillChipText}>{s}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Verification */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Verification</Text>
                    <View style={[styles.verifyRow, { backgroundColor: profile.is_verified ? '#D1FAE530' : '#FEF3C730' }]}>
                        {profile.is_verified ? (
                            <CheckCircle size={20} color={colors.secondary.DEFAULT} />
                        ) : (
                            <Shield size={20} color={colors.semantic.warning} />
                        )}
                        <Text style={[styles.verifyText, { color: profile.is_verified ? colors.secondary.DEFAULT : colors.semantic.warning }]}>
                            {profile.is_verified ? 'License Verified' : 'Pending Verification'}
                        </Text>
                    </View>
                </View>

                {/* Reviews */}
                {reviews.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Reviews</Text>
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

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    content: { padding: spacing.md },
    profileCard: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md, ...shadows.md,
    },
    avatarSection: { position: 'relative', marginBottom: spacing.md },
    avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.border.DEFAULT },
    avatarPlaceholder: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    verifiedBadge: {
        position: 'absolute', bottom: 2, right: 2,
        backgroundColor: colors.secondary.DEFAULT, borderRadius: 12, padding: 2,
        borderWidth: 2, borderColor: colors.background.paper,
    },
    name: { fontSize: 22, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.xs },
    specialtyBadge: {
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.sm,
    },
    specialtyText: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 16, fontWeight: 'bold', color: colors.text.primary },
    reviewCountText: { fontSize: 13, color: colors.text.secondary },
    statsRow: {
        flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md,
    },
    statBox: {
        flex: 1, backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, alignItems: 'center', ...shadows.sm,
    },
    statValue: { fontSize: 20, fontWeight: 'bold', color: colors.text.primary, marginTop: spacing.xs },
    statLabel: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    bioText: { fontSize: 15, color: colors.text.primary, lineHeight: 22 },
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    skillChip: {
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: 6,
    },
    skillChipText: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '500' },
    verifyRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        padding: spacing.md, borderRadius: borderRadii.md,
    },
    verifyText: { fontSize: 14, fontWeight: '600' },
    reviewCard: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reviewStars: { flexDirection: 'row', gap: 2 },
    reviewDate: { fontSize: 11, color: colors.text.disabled },
    reviewComment: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
});

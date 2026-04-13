import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star } from 'lucide-react-native';
import { Button } from '../../../src/components/common/Button';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api } from '../../../src/services/api';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const ASPECTS = [
    { key: 'cleanliness', label: 'Cleanliness' },
    { key: 'staff', label: 'Staff & Service' },
    { key: 'wait_time', label: 'Wait Time' },
    { key: 'value', label: 'Value for Money' },
];

export default function ReviewScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [overallRating, setOverallRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [aspectRatings, setAspectRatings] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [revieweeId, setRevieweeId] = useState<string | null>(null);
    const [loadingBooking, setLoadingBooking] = useState(true);

    useEffect(() => {
        const fetchBooking = async () => {
            try {
                const res = await api.get(`/booking/${id}`);
                const booking = res.data;
                const clinicUserId = booking.clinic?.user_id || booking.clinic_user_id;
                if (clinicUserId) {
                    setRevieweeId(clinicUserId);
                }
            } catch (err) {
                console.error('Failed to fetch booking for reviewee ID:', err);
            } finally {
                setLoadingBooking(false);
            }
        };
        if (id && id !== 'undefined') fetchBooking();
    }, [id]);

    const handleSubmit = async () => {
        if (overallRating === 0) {
            Alert.alert('Rating required', 'Please select an overall rating.');
            return;
        }
        if (!revieweeId) {
            Alert.alert('Error', 'Could not determine who to review. Please try again.');
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post('/reviews', {
                bookingId: id,
                revieweeId,
                rating: overallRating,
                comment,
            });
            Alert.alert('Thank you!', 'Your review has been submitted.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Failed', err.response?.data?.message || 'Could not submit review.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const StarRow = ({
        rating, onRate, size = 36
    }: {
        rating: number; onRate: (n: number) => void; size?: number
    }) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => onRate(n)} activeOpacity={0.7}>
                    <Star
                        size={size}
                        color={colors.semantic.warning}
                        fill={n <= (hoveredStar || rating) ? colors.semantic.warning : 'transparent'}
                        strokeWidth={1.5}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Write a Review</Text>
                <View style={{ width: 26 }} />
            </View>

            {loadingBooking ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Overall Rating */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Overall Experience</Text>
                    <Text style={styles.cardSubtitle}>How would you rate this visit?</Text>

                    <StarRow rating={overallRating} onRate={setOverallRating} size={40} />

                    {overallRating > 0 && (
                        <Text style={styles.ratingLabel}>{RATING_LABELS[overallRating]}</Text>
                    )}
                </View>

                {/* Aspect Ratings */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Detailed Ratings</Text>
                    {ASPECTS.map((aspect) => (
                        <View key={aspect.key} style={styles.aspectRow}>
                            <Text style={styles.aspectLabel}>{aspect.label}</Text>
                            <View style={styles.aspectStars}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <TouchableOpacity
                                        key={n}
                                        onPress={() =>
                                            setAspectRatings((prev) => ({ ...prev, [aspect.key]: n }))
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <Star
                                            size={22}
                                            color={colors.semantic.warning}
                                            fill={n <= (aspectRatings[aspect.key] || 0) ? colors.semantic.warning : 'transparent'}
                                            strokeWidth={1.5}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>

                {/* Comment */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Your Comments</Text>
                    <Text style={styles.cardSubtitle}>Share your experience (optional)</Text>
                    <TextInput
                        style={styles.commentInput}
                        multiline
                        numberOfLines={5}
                        placeholder="What did you like or dislike about this visit?"
                        placeholderTextColor={colors.text.disabled}
                        value={comment}
                        onChangeText={setComment}
                        maxLength={500}
                        textAlignVertical="top"
                    />
                    <Text style={styles.charCount}>{comment.length}/500</Text>
                </View>

                <Button
                    title="Submit Review"
                    onPress={handleSubmit}
                    isLoading={isSubmitting}
                    disabled={overallRating === 0 || !revieweeId}
                    style={styles.submitBtn}
                />

                <View style={{ height: 40 }} />
            </ScrollView>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { padding: spacing.md },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
    },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.xs },
    cardSubtitle: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing.md },
    starRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.sm },
    ratingLabel: {
        textAlign: 'center', fontSize: 16, fontWeight: '600',
        color: colors.semantic.warning, marginTop: spacing.xs,
    },
    aspectRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    aspectLabel: { fontSize: 14, color: colors.text.primary },
    aspectStars: { flexDirection: 'row', gap: 4 },
    commentInput: {
        backgroundColor: colors.background.DEFAULT, borderRadius: borderRadii.md,
        padding: spacing.md, fontSize: 15, color: colors.text.primary,
        minHeight: 120, borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    charCount: { fontSize: 12, color: colors.text.disabled, textAlign: 'right', marginTop: spacing.xs },
    submitBtn: { marginTop: spacing.sm },
});

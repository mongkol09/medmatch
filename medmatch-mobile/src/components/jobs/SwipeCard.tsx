import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MapPin, Clock, DollarSign, Briefcase } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../theme';
import { resolveImageUrl } from '../../services/api';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

export interface Job {
    id: string;
    title: string;
    clinic: {
        clinic_name: string;
        address: string;
        images: string[];
    };
    specialty_required: string;
    work_date: string;
    start_time: string;
    end_time: string;
    pay_amount: number;
    distance_km?: number;
}

interface SwipeCardProps {
    job: Job;
    onSwipeRight: (job: Job) => void;
    onSwipeLeft: (job: Job) => void;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({ job, onSwipeRight, onSwipeLeft }) => {
    const [imgIndex, setImgIndex] = useState(0);
    const images = job.clinic.images?.filter(Boolean) ?? [];
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (translateX.value > SWIPE_THRESHOLD) {
                // Swiped right (Apply)
                translateX.value = withTiming(width + 100, { duration: 300 }, () => {
                    runOnJS(onSwipeRight)(job);
                });
            } else if (translateX.value < -SWIPE_THRESHOLD) {
                // Swiped left (Pass)
                translateX.value = withTiming(-width - 100, { duration: 300 }, () => {
                    runOnJS(onSwipeLeft)(job);
                });
            } else {
                // Return to center
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        const rotate = interpolate(
            translateX.value,
            [-width / 2, 0, width / 2],
            [-15, 0, 15]
        );

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    const likeOpacity = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, width / 4], [0, 1]),
    }));

    const nopeOpacity = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, -width / 4], [0, 1]),
    }));

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.card, animatedStyle]}>
                {/* Image Carousel */}
                <View style={styles.imageContainer}>
                    {images.length > 0 ? (
                        <Image
                            source={{ uri: resolveImageUrl(images[imgIndex]) }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.image, styles.imagePlaceholder]}>
                            <Briefcase size={56} color={colors.text.disabled} />
                            <Text style={styles.placeholderText}>{job.clinic.clinic_name}</Text>
                        </View>
                    )}
                    {images.length > 1 && (
                        <>
                            <TouchableOpacity
                                style={styles.imgZoneLeft}
                                onPress={() => setImgIndex(i => Math.max(i - 1, 0))}
                                activeOpacity={1}
                            />
                            <TouchableOpacity
                                style={styles.imgZoneRight}
                                onPress={() => setImgIndex(i => Math.min(i + 1, images.length - 1))}
                                activeOpacity={1}
                            />
                            <View style={styles.dotsContainer}>
                                {images.map((_, i) => (
                                    <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
                                ))}
                            </View>
                        </>
                    )}
                </View>

                {/* Pay badge on top of image */}
                <View style={styles.payBadge}>
                    <DollarSign size={14} color="#fff" />
                    <Text style={styles.payBadgeText}>{job.pay_amount.toLocaleString()} THB</Text>
                </View>

                {/* Card Content */}
                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
                        {job.distance_km != null && job.distance_km > 0 ? (
                            <View style={styles.distanceChip}>
                                <MapPin size={11} color={colors.primary.DEFAULT} />
                                <Text style={styles.distanceText}>{job.distance_km} km</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={styles.clinicName} numberOfLines={1}>{job.clinic.clinic_name}</Text>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Clock size={14} color={colors.primary.light} />
                            <Text style={styles.infoText}>
                                {job.start_time} – {job.end_time}
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <MapPin size={14} color={colors.primary.light} />
                            <Text style={styles.infoText} numberOfLines={1}>
                                {job.clinic.address}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.dateRow}>
                        <Text style={styles.dateLabel}>Work Date</Text>
                        <Text style={styles.dateValue}>
                            {new Date(job.work_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                    </View>
                </View>

                {/* Swipe Indicators */}
                <Animated.View style={[styles.swipeIndicator, styles.likeIndicator, likeOpacity]}>
                    <Text style={styles.likeText}>✓ APPLY</Text>
                </Animated.View>
                <Animated.View style={[styles.swipeIndicator, styles.nopeIndicator, nopeOpacity]}>
                    <Text style={styles.nopeText}>✕ PASS</Text>
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        width: width * 0.9,
        height: height * 0.62,
        backgroundColor: colors.background.paper,
        borderRadius: borderRadii.xl,
        overflow: 'hidden',
        ...shadows.lg,
    },
    imageContainer: {
        width: '100%',
        height: '50%',
    },
    image: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.background.DEFAULT,
    },
    imgZoneLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '40%',
        height: '100%',
    },
    imgZoneRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        width: '40%',
        height: '100%',
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 5,
    },
    dot: {
        height: 5,
        width: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    dotActive: {
        width: 18,
        backgroundColor: '#fff',
    },
    imagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        gap: spacing.sm,
    },
    placeholderText: {
        fontSize: 14,
        color: colors.text.disabled,
        fontWeight: '500',
    },
    payBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.secondary.DEFAULT,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadii.full,
    },
    payBadgeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    content: {
        padding: spacing.lg,
        flex: 1,
        justifyContent: 'space-between',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
        flex: 1,
        letterSpacing: -0.3,
    },
    distanceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.primary.transparent,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadii.full,
    },
    distanceText: {
        fontSize: 12,
        color: colors.primary.DEFAULT,
        fontWeight: '600',
    },
    clinicName: {
        fontSize: 14,
        color: colors.primary.DEFAULT,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.light,
        marginVertical: 4,
    },
    infoRow: {
        gap: spacing.xs,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    infoText: {
        fontSize: 13,
        color: colors.text.secondary,
        flex: 1,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background.DEFAULT,
        padding: spacing.sm,
        borderRadius: borderRadii.md,
    },
    dateLabel: {
        fontSize: 12,
        color: colors.text.disabled,
        fontWeight: '500',
    },
    dateValue: {
        fontSize: 13,
        color: colors.text.primary,
        fontWeight: '700',
    },
    swipeIndicator: {
        position: 'absolute',
        top: 50,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderWidth: 3,
        borderRadius: borderRadii.md,
    },
    likeIndicator: {
        left: 20,
        borderColor: colors.semantic.success,
        backgroundColor: 'rgba(16,185,129,0.1)',
    },
    nopeIndicator: {
        right: 20,
        borderColor: colors.semantic.error,
        backgroundColor: 'rgba(239,68,68,0.1)',
    },
    likeText: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.semantic.success,
        letterSpacing: 2,
    },
    nopeText: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.semantic.error,
        letterSpacing: 2,
    },
});

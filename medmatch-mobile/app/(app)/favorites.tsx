/**
 * Favorite Clinics Screen — PATIENT
 * Saves favorite clinic IDs to AsyncStorage.
 * Shows saved clinics with quick-book action.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, Heart, MapPin, Star, Calendar, Trash2 } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

const FAVORITES_KEY = '@medmatch_favorite_clinics';

interface ClinicPreview {
    id: string;
    clinic_name: string;
    address: string;
    average_rating?: number;
    review_count?: number;
    consultation_fee?: number;
    images?: string[];
    description?: string;
}

export default function FavoritesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
    const [clinics, setClinics] = useState<ClinicPreview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadFavorites = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const stored = await AsyncStorage.getItem(FAVORITES_KEY);
            const ids: string[] = stored ? JSON.parse(stored) : [];
            setFavoriteIds(ids);

            if (ids.length === 0) {
                setClinics([]);
                return;
            }

            // Fetch each clinic profile
            const results = await Promise.allSettled(
                ids.map(id => api.get(`/profile/clinic/${id}`))
            );
            const loaded: ClinicPreview[] = results
                .filter(r => r.status === 'fulfilled')
                .map(r => (r as PromiseFulfilledResult<any>).value.data);
            setClinics(loaded);
        } catch {
            setClinics([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { loadFavorites(); }, []);

    const removeFavorite = async (clinicId: string) => {
        Alert.alert('Remove Favorite', 'Remove this clinic from your favorites?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    const newIds = favoriteIds.filter(id => id !== clinicId);
                    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newIds));
                    setFavoriteIds(newIds);
                    setClinics(prev => prev.filter(c => c.id !== clinicId));
                },
            },
        ]);
    };

    const renderClinic = ({ item }: { item: ClinicPreview }) => (
        <View style={styles.card}>
            <TouchableOpacity
                style={styles.cardBody}
                onPress={() => router.push({ pathname: '/(app)/booking/clinic/[id]', params: { id: item.id } })}
                activeOpacity={0.7}
            >
                {/* Clinic Info */}
                <View style={styles.clinicHeader}>
                    <View style={styles.clinicAvatar}>
                        <Heart size={20} color={colors.semantic.error} fill={colors.semantic.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.clinicName} numberOfLines={1}>{item.clinic_name}</Text>
                        {item.average_rating != null && (
                            <View style={styles.ratingRow}>
                                <Star size={12} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                <Text style={styles.ratingText}>
                                    {item.average_rating.toFixed(1)}
                                    {item.review_count ? ` (${item.review_count})` : ''}
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeFavorite(item.id)}
                    >
                        <Trash2 size={16} color={colors.semantic.error} />
                    </TouchableOpacity>
                </View>

                {item.address && (
                    <View style={styles.addressRow}>
                        <MapPin size={13} color={colors.text.disabled} />
                        <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
                    </View>
                )}

                {item.description && (
                    <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                )}

                <View style={styles.cardFooter}>
                    {item.consultation_fee != null && (
                        <Text style={styles.feeText}>฿{item.consultation_fee.toLocaleString()} / visit</Text>
                    )}
                    <TouchableOpacity
                        style={styles.bookBtn}
                        onPress={() => router.push({ pathname: '/(app)/booking/clinic/[id]', params: { id: item.id } })}
                    >
                        <Calendar size={14} color={colors.text.inverse} />
                        <Text style={styles.bookBtnText}>Book Now</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Saved Clinics</Text>
                <View style={{ width: 26 }} />
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : clinics.length === 0 ? (
                <View style={styles.centered}>
                    <Heart size={48} color={colors.border.DEFAULT} />
                    <Text style={styles.emptyTitle}>No Saved Clinics</Text>
                    <Text style={styles.emptySubtext}>
                        Tap the ♥ icon on a clinic to save it here for quick booking.
                    </Text>
                    <TouchableOpacity
                        style={styles.exploreBtn}
                        onPress={() => router.push('/(app)/home' as any)}
                    >
                        <Text style={styles.exploreBtnText}>Explore Clinics</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={clinics}
                    keyExtractor={item => item.id}
                    renderItem={renderClinic}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); loadFavorites(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                    ListHeaderComponent={() => (
                        <Text style={styles.countLabel}>{clinics.length} saved clinic{clinics.length > 1 ? 's' : ''}</Text>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    list: { padding: spacing.md, paddingBottom: 40 },
    countLabel: { fontSize: 12, color: colors.text.disabled, marginBottom: spacing.sm },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginTop: spacing.lg },
    emptySubtext: {
        fontSize: 14, color: colors.text.secondary, textAlign: 'center',
        marginTop: spacing.sm, lineHeight: 20,
    },
    exploreBtn: {
        marginTop: spacing.xl, backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderRadius: borderRadii.full,
    },
    exploreBtnText: { color: colors.text.inverse, fontWeight: '700', fontSize: 15 },
    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg, ...shadows.sm,
    },
    cardBody: { padding: spacing.lg },
    clinicHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    clinicAvatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.semantic.error + '15',
        justifyContent: 'center', alignItems: 'center',
    },
    clinicName: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    ratingText: { fontSize: 12, color: colors.text.secondary },
    removeBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.semantic.error + '12',
        justifyContent: 'center', alignItems: 'center',
    },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
    addressText: { fontSize: 12, color: colors.text.secondary, flex: 1 },
    description: { fontSize: 13, color: colors.text.secondary, lineHeight: 18, marginBottom: spacing.sm },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
    feeText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
    bookBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.md, paddingVertical: 8,
        borderRadius: borderRadii.full,
    },
    bookBtnText: { fontSize: 13, fontWeight: '700', color: colors.text.inverse },
});

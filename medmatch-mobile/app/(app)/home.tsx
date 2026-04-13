import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, Dimensions, ActivityIndicator,
    TouchableOpacity, Image, ScrollView, RefreshControl
} from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Search, MapPin, Star, Navigation, Heart } from 'lucide-react-native';
import { Input } from '../../src/components/common/Input';
import { colors, spacing, borderRadii } from '../../src/theme';
import { api, resolveImageUrl } from '../../src/services/api';

const { width, height } = Dimensions.get('window');

// Fallback: Bangkok
const FALLBACK_REGION: Region = {
    latitude: 13.7563,
    longitude: 100.5018,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};

interface ClinicPreview {
    id: string;
    clinic_name: string;
    address: string;
    average_rating?: number;
    review_count?: number;
    images?: string[];
    latitude: number;
    longitude: number;
    distance_km?: number;
}

export default function PatientHomeScreen() {
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const isAnimatingRef = useRef(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [clinics, setClinics] = useState<ClinicPreview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [region, setRegion] = useState<Region>(FALLBACK_REGION);
    const [userLocation, setUserLocation] = useState<Region | null>(null);
    const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

    const FAVORITES_KEY = '@medmatch_favorite_clinics';

    useEffect(() => {
        AsyncStorage.getItem(FAVORITES_KEY).then(v => {
            if (v) setFavoriteIds(JSON.parse(v));
        });
    }, []);

    const toggleFavorite = async (clinicId: string) => {
        const next = favoriteIds.includes(clinicId)
            ? favoriteIds.filter(id => id !== clinicId)
            : [...favoriteIds, clinicId];
        setFavoriteIds(next);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    };

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const gpsRegion: Region = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                };
                setUserLocation(gpsRegion);
                setRegion(gpsRegion);
                mapRef.current?.animateToRegion(gpsRegion, 500);
                fetchClinics(gpsRegion);
            } else {
                fetchClinics(FALLBACK_REGION);
            }
        })();
    }, []);

    const fetchClinics = async (r: Region) => {
        try {
            const res = await api.get('/map/clinics/preview', {
                params: {
                    latitude: r.latitude,
                    longitude: r.longitude,
                    radiusKm: Math.round(r.latitudeDelta * 111),
                },
            });
            setClinics(Array.isArray(res.data) ? res.data : []);
        } catch {
            // Keep existing clinics on error
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) return fetchClinics(region);

        setIsLoading(true);

        // 1) Geocode with Nominatim — use boundingbox for correct zoom level
        try {
            const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=th`,
                { headers: { 'Accept-Language': 'th' } },
            );
            const geoData = await geoRes.json();
            if (Array.isArray(geoData) && geoData.length > 0) {
                const { lat, lon, boundingbox } = geoData[0];
                // boundingbox = [south, north, west, east]
                const latDelta = Math.min(
                    Math.abs(parseFloat(boundingbox[1]) - parseFloat(boundingbox[0])) * 1.3,
                    3.0,
                );
                const lonDelta = Math.min(
                    Math.abs(parseFloat(boundingbox[3]) - parseFloat(boundingbox[2])) * 1.3,
                    3.0,
                );
                const newRegion: Region = {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lon),
                    latitudeDelta: Math.max(latDelta, 0.05),
                    longitudeDelta: Math.max(lonDelta, 0.05),
                };

                // Mark animating so onRegionChangeComplete doesn't double-fetch
                isAnimatingRef.current = true;
                mapRef.current?.animateToRegion(newRegion, 800);
                setRegion(newRegion);

                // Wait for animation + tile load, then fetch clinics
                setTimeout(() => {
                    isAnimatingRef.current = false;
                    fetchClinics(newRegion);
                }, 1200);
                return;
            }
        } catch {}

        // 2) Fallback: search clinics by name via API
        try {
            const res = await api.get('/map/search', { params: { q, type: 'clinic' } });
            setClinics(Array.isArray(res.data) ? res.data : []);
        } catch {}
        setIsLoading(false);
    }, [region]);

    useEffect(() => {
        const timeout = setTimeout(() => handleSearch(searchQuery), 500);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const navigateToClinic = (clinicId: string) => {
        router.push({ pathname: '/(app)/booking/clinic/[id]', params: { id: clinicId } });
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={FALLBACK_REGION}
                showsUserLocation
                showsMyLocationButton={false}
                onRegionChangeComplete={(r) => {
                    if (isAnimatingRef.current) return;
                    setRegion(r);
                    fetchClinics(r);
                }}
            >
                {clinics.map((clinic) => (
                    <Marker
                        key={clinic.id}
                        coordinate={{ latitude: clinic.latitude, longitude: clinic.longitude }}
                    >
                        <View style={styles.markerContainer}>
                            <View style={styles.markerBubble}>
                                <MapPin size={16} color={colors.primary.DEFAULT} />
                            </View>
                        </View>
                        <Callout tooltip onPress={() => navigateToClinic(clinic.id)}>
                            <View style={styles.callout}>
                                <Text style={styles.calloutTitle} numberOfLines={1}>{clinic.clinic_name}</Text>
                                {clinic.average_rating != null && (
                                    <View style={styles.ratingRow}>
                                        <Star size={11} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                        <Text style={styles.ratingText}>{clinic.average_rating.toFixed(1)}</Text>
                                    </View>
                                )}
                                <Text style={styles.calloutCta}>View Clinic →</Text>
                            </View>
                        </Callout>
                    </Marker>
                ))}
            </MapView>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Input
                    placeholder="Search clinics or specialties..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    leftIcon={<Search size={20} color={colors.text.disabled} />}
                    style={styles.searchInput}
                />
            </View>

            {/* My Location Button */}
            <TouchableOpacity
                style={styles.locationBtn}
                onPress={() => mapRef.current?.animateToRegion(userLocation || FALLBACK_REGION, 500)}
            >
                <Navigation size={20} color={colors.primary.DEFAULT} />
            </TouchableOpacity>

            {/* Bottom Sheet */}
            <View style={styles.bottomSheet}>
                <Text style={styles.sheetTitle}>
                    Nearby Clinics{clinics.length > 0 ? ` (${clinics.length})` : ''}
                </Text>

                {isLoading ? (
                    <ActivityIndicator color={colors.primary.DEFAULT} style={{ marginTop: spacing.md }} />
                ) : clinics.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MapPin size={32} color={colors.border.DEFAULT} />
                        <Text style={styles.emptyText}>No clinics found in this area</Text>
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={() => { setIsRefreshing(true); fetchClinics(region); }}
                                tintColor={colors.primary.DEFAULT}
                            />
                        }
                    >
                        {clinics.map((clinic) => (
                            <TouchableOpacity
                                key={clinic.id}
                                style={styles.clinicCard}
                                onPress={() => navigateToClinic(clinic.id)}
                                activeOpacity={0.7}
                            >
                                {clinic.images?.[0] ? (
                                    <Image source={{ uri: resolveImageUrl(clinic.images[0]) }} style={styles.clinicImage} />
                                ) : (
                                    <View style={[styles.clinicImage, styles.clinicImagePlaceholder]}>
                                        <MapPin size={24} color={colors.border.DEFAULT} />
                                    </View>
                                )}
                                <View style={styles.clinicInfo}>
                                    <Text style={styles.clinicName} numberOfLines={1}>{clinic.clinic_name}</Text>
                                    <Text style={styles.clinicAddress} numberOfLines={1}>{clinic.address}</Text>
                                    <View style={styles.clinicMeta}>
                                        {clinic.average_rating != null && (
                                            <View style={styles.ratingRow}>
                                                <Star size={13} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                                <Text style={styles.ratingTextInfo}>
                                                    {clinic.average_rating.toFixed(1)}
                                                    {clinic.review_count ? ` (${clinic.review_count})` : ''}
                                                </Text>
                                            </View>
                                        )}
                                        {clinic.distance_km != null && (
                                            <Text style={styles.distanceText}>{clinic.distance_km.toFixed(1)} km</Text>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.heartBtn}
                                    onPress={() => toggleFavorite(clinic.id)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Heart
                                        size={20}
                                        color={colors.semantic.error}
                                        fill={favoriteIds.includes(clinic.id) ? colors.semantic.error : 'transparent'}
                                    />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    map: { width, height: height * 0.52 },
    searchContainer: {
        position: 'absolute', top: 60, left: spacing.lg, right: spacing.lg,
        shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
    },
    searchInput: {
        backgroundColor: colors.background.paper, borderWidth: 0,
        borderRadius: borderRadii.xl, height: 52,
    },
    locationBtn: {
        position: 'absolute', top: 124, right: spacing.lg,
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: colors.background.paper,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    },
    markerContainer: { alignItems: 'center' },
    markerBubble: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.full,
        padding: 6, borderWidth: 2, borderColor: colors.primary.DEFAULT,
        shadowColor: colors.primary.DEFAULT, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
    },
    callout: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.md,
        padding: spacing.sm, width: 160,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
        borderWidth: 1, borderColor: colors.border.light,
    },
    calloutTitle: { fontWeight: '700', fontSize: 13, color: colors.text.primary, marginBottom: 4 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 11, color: colors.text.secondary },
    calloutCta: { fontSize: 12, color: colors.primary.DEFAULT, fontWeight: '700', marginTop: 6 },
    bottomSheet: {
        flex: 1, marginTop: -24,
        backgroundColor: colors.background.paper,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: spacing.lg, paddingHorizontal: spacing.xl,
        paddingBottom: 100,
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
    },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text.primary, marginBottom: spacing.md },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
    emptyText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
    clinicCard: {
        flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm,
        backgroundColor: '#F8FAFF', padding: spacing.md,
        borderRadius: borderRadii.lg, borderWidth: 1, borderColor: colors.border.light,
    },
    clinicImage: { width: 64, height: 64, borderRadius: borderRadii.md },
    clinicImagePlaceholder: {
        backgroundColor: '#E8EFFF', justifyContent: 'center', alignItems: 'center',
    },
    clinicInfo: { marginLeft: spacing.md, flex: 1 },
    clinicName: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    clinicAddress: { fontSize: 12, color: colors.text.secondary, marginTop: 2, marginBottom: 4 },
    clinicMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    ratingTextInfo: { fontSize: 13, color: colors.text.primary, fontWeight: '600' },
    distanceText: { fontSize: 12, color: colors.text.disabled, fontWeight: '500' },
    heartBtn: { padding: spacing.xs, marginLeft: spacing.xs },
});

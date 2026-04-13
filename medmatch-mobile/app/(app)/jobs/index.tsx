import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Image, StyleSheet, ActivityIndicator, Alert, TouchableOpacity,
    SafeAreaView, Modal, ScrollView, TextInput, Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import { SwipeCard, Job } from '../../../src/components/jobs/SwipeCard';
import { DatePickerField } from '../../../src/components/common/DatePickerField';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, resolveImageUrl } from '../../../src/services/api';
import { RefreshCw, Briefcase, CheckCircle, XCircle, SlidersHorizontal, X, ChevronDown, MapPin } from 'lucide-react-native';

// ──────────────────────────────────────────────
// Filter types
// ──────────────────────────────────────────────
interface Filters {
    specialty: string;
    radiusKm: number;       // 0 = nationwide
    minPay: string;
    date: string;
    sortBy: string;
    searchLocation: string; // display label for custom location
    searchLat: number | null;
    searchLng: number | null;
}

const DEFAULT_FILTERS: Filters = {
    specialty: '',
    radiusKm: 100,
    minPay: '',
    date: '',
    sortBy: 'newest',
    searchLocation: '',
    searchLat: null,
    searchLng: null,
};

const SPECIALTIES = [
    { value: '', label: 'All' },
    { value: 'DENTIST', label: 'ทันตแพทย์' },
    { value: 'DOCTOR', label: 'แพทย์ทั่วไป' },
    { value: 'PHARMACIST', label: 'เภสัชกร' },
    { value: 'NURSE', label: 'พยาบาล' },
    { value: 'DENTAL_ASSISTANT', label: 'ผู้ช่วยทันตแพทย์' },
    { value: 'PHYSIOTHERAPIST', label: 'นักกายภาพบำบัด' },
    { value: 'OTHER', label: 'อื่นๆ' },
];

const RADII = [
    { value: 0, label: 'ทั่วประเทศ' },
    { value: 10, label: '10 km' },
    { value: 20, label: '20 km' },
    { value: 50, label: '50 km' },
    { value: 100, label: '100 km' },
    { value: 200, label: '200 km' },
    { value: 500, label: '500 km' },
];
const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'pay', label: 'Highest Pay' },
    { value: 'distance', label: 'Nearest' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

// ──────────────────────────────────────────────
export default function JobsScreen() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
    const [appliedCount, setAppliedCount] = useState(0);
    const [passedCount, setPassedCount] = useState(0);
    const [detailJob, setDetailJob] = useState<Job | null>(null);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxVisible, setLightboxVisible] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [userLat, setUserLat] = useState(13.7563);
    const [userLng, setUserLng] = useState(100.5018);
    const [locationQuery, setLocationQuery] = useState('');
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);

    const searchLocation = async (query: string) => {
        if (!query.trim()) return;
        setIsSearchingLocation(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=th&limit=1`,
                { headers: { 'Accept-Language': 'th' } },
            );
            const data = await res.json();
            if (data.length > 0) {
                const place = data[0];
                setPendingFilters(f => ({
                    ...f,
                    searchLat: parseFloat(place.lat),
                    searchLng: parseFloat(place.lon),
                    searchLocation: place.display_name.split(',')[0],
                    // Auto-switch from nationwide if user searches a location
                    radiusKm: f.radiusKm === 0 ? 50 : f.radiusKm,
                }));
                Alert.alert('Found', `${place.display_name.split(',').slice(0, 2).join(', ')}`);
            } else {
                Alert.alert('Not Found', 'Could not find that location. Try a different keyword.');
            }
        } catch {
            Alert.alert('Error', 'Location search failed. Check your internet connection.');
        } finally {
            setIsSearchingLocation(false);
        }
    };

    // Fetch existing applications to filter already-applied jobs
    useEffect(() => {
        api.get('/jobs/my-applications').then(res => {
            const ids = new Set<string>(
                (res.data || []).map((app: any) => app.job?.id).filter(Boolean)
            );
            setAppliedJobIds(ids);
            setAppliedCount(ids.size);
        }).catch(() => {});
    }, []);

    // Get user GPS on mount
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLat(loc.coords.latitude);
                setUserLng(loc.coords.longitude);
            }
        })();
    }, []);

    const fetchJobs = useCallback(async (f: Filters = filters) => {
        setIsLoading(true);
        try {
            const isNationwide = f.radiusKm === 0;
            const params: Record<string, any> = {
                sortBy: f.sortBy,
            };

            // Only send location when NOT nationwide
            if (!isNationwide) {
                // Use custom search location if set, otherwise GPS
                params.latitude = f.searchLat ?? userLat;
                params.longitude = f.searchLng ?? userLng;
                params.radiusKm = f.radiusKm;
            }

            if (f.specialty) params.specialty = f.specialty;
            if (f.minPay) params.minPay = Number(f.minPay);
            if (f.date) params.date = f.date;

            const res = await api.get('/jobs/browse', { params });
            const allJobs: Job[] = res.data.data || [];
            setJobs(allJobs.filter(j => !appliedJobIds.has(j.id)));
        } catch {
            setJobs([]);
        } finally {
            setIsLoading(false);
        }
    }, [userLat, userLng, filters, appliedJobIds]);

    useEffect(() => { fetchJobs(); }, [userLat, userLng]);

    const handleSwipeRight = async (job: Job) => {
        try {
            await api.post(`/jobs/${job.id}/apply`);
            setAppliedJobIds(prev => new Set(prev).add(job.id));
            setAppliedCount(c => c + 1);
        } catch (e: any) {
            Alert.alert('Apply Failed', e.response?.data?.message || 'Failed to apply for this job');
        }
        setJobs(prev => prev.filter(j => j.id !== job.id));
    };

    const handleSwipeLeft = (job: Job) => {
        setPassedCount(c => c + 1);
        setJobs(prev => prev.filter(j => j.id !== job.id));
    };

    const handleViewDetails = (job: Job) => setDetailJob(job);

    const applyFilters = () => {
        setFilters(pendingFilters);
        setShowFilter(false);
        fetchJobs(pendingFilters);
    };

    const resetFilters = () => {
        setPendingFilters(DEFAULT_FILTERS);
        setLocationQuery('');
    };

    const activeFilterCount = [
        filters.specialty,
        filters.radiusKm !== 100 ? String(filters.radiusKm) : '',
        filters.minPay,
        filters.date,
        filters.sortBy !== 'newest' ? filters.sortBy : '',
        filters.searchLocation,
    ].filter(Boolean).length;

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                    <Text style={styles.loadingText}>Finding jobs near you...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Discover Jobs</Text>
                    <Text style={styles.headerSubtitle}>
                        {jobs.length > 0
                            ? filters.radiusKm === 0
                                ? `${jobs.length} jobs · ทั่วประเทศ`
                                : filters.searchLocation
                                    ? `${jobs.length} jobs · ${filters.searchLocation} (${filters.radiusKm}km)`
                                    : `${jobs.length} jobs · ${filters.radiusKm}km radius`
                            : filters.radiusKm === 0
                                ? 'No jobs found nationwide'
                                : 'No jobs in this area'}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnActive]}
                        onPress={() => { setPendingFilters(filters); setShowFilter(true); }}
                    >
                        <SlidersHorizontal size={20} color={activeFilterCount > 0 ? colors.text.inverse : colors.primary.DEFAULT} />
                        {activeFilterCount > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => fetchJobs()}>
                        <RefreshCw size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
                <View style={styles.statChip}>
                    <CheckCircle size={14} color={colors.semantic.success} />
                    <Text style={[styles.statText, { color: colors.semantic.success }]}>{appliedCount} Applied</Text>
                </View>
                <View style={styles.statChip}>
                    <XCircle size={14} color={colors.text.disabled} />
                    <Text style={[styles.statText, { color: colors.text.disabled }]}>{passedCount} Passed</Text>
                </View>
                {filters.specialty ? (
                    <View style={[styles.statChip, { backgroundColor: colors.primary.transparent }]}>
                        <Text style={[styles.statText, { color: colors.primary.DEFAULT }]}>
                            {SPECIALTIES.find(s => s.value === filters.specialty)?.label}
                        </Text>
                    </View>
                ) : null}
                {filters.minPay ? (
                    <View style={[styles.statChip, { backgroundColor: colors.secondary.DEFAULT + '18' }]}>
                        <Text style={[styles.statText, { color: colors.secondary.DEFAULT }]}>
                            ≥฿{Number(filters.minPay).toLocaleString()}
                        </Text>
                    </View>
                ) : null}
                {filters.radiusKm === 0 ? (
                    <View style={[styles.statChip, { backgroundColor: '#FEF3C7' }]}>
                        <MapPin size={12} color="#D97706" />
                        <Text style={[styles.statText, { color: '#D97706' }]}>ทั่วประเทศ</Text>
                    </View>
                ) : null}
                {filters.searchLocation ? (
                    <View style={[styles.statChip, { backgroundColor: colors.primary.transparent }]}>
                        <MapPin size={12} color={colors.primary.DEFAULT} />
                        <Text style={[styles.statText, { color: colors.primary.DEFAULT }]}>{filters.searchLocation}</Text>
                    </View>
                ) : null}
            </View>

            {/* Card area */}
            <View style={styles.cardContainer}>
                {jobs.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIcon}>
                            <Briefcase size={48} color={colors.text.disabled} />
                        </View>
                        <Text style={styles.emptyText}>No more jobs in your area.</Text>
                        <Text style={styles.emptySubtext}>Check back later or adjust your filters!</Text>
                        <TouchableOpacity style={styles.reloadBtn} onPress={() => fetchJobs()}>
                            <RefreshCw size={16} color={colors.primary.DEFAULT} />
                            <Text style={styles.reloadBtnText}>Refresh</Text>
                        </TouchableOpacity>
                        {activeFilterCount > 0 && (
                            <TouchableOpacity
                                style={[styles.reloadBtn, { backgroundColor: colors.border.light }]}
                                onPress={() => { setFilters(DEFAULT_FILTERS); fetchJobs(DEFAULT_FILTERS); }}
                            >
                                <X size={16} color={colors.text.secondary} />
                                <Text style={[styles.reloadBtnText, { color: colors.text.secondary }]}>Clear Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    jobs.slice().reverse().map((job, index, arr) => {
                        const isTopCard = index === arr.length - 1;
                        return (
                            <View key={job.id} style={StyleSheet.absoluteFillObject} pointerEvents={isTopCard ? 'auto' : 'none'}>
                                <SwipeCard job={job} onSwipeRight={handleSwipeRight} onSwipeLeft={handleSwipeLeft} />
                            </View>
                        );
                    })
                )}
            </View>

            {jobs.length > 0 && (
                <View style={styles.hint}>
                    <Text style={styles.hintPass}>← Pass</Text>
                    <Text style={styles.hintCenter}>Swipe to decide</Text>
                    <Text style={styles.hintApply}>Apply →</Text>
                </View>
            )}

            {jobs.length > 0 && (
                <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    onPress={() => handleViewDetails(jobs[0])}
                >
                    <Text style={styles.viewDetailsBtnText}>View Job Details</Text>
                </TouchableOpacity>
            )}

            {/* Job Detail Modal */}
            <Modal
                visible={!!detailJob}
                animationType="slide"
                transparent
                presentationStyle="overFullScreen"
            >
                {detailJob && (
                    <View style={styles.detailOverlay}>
                        <View style={styles.detailSheet}>
                            <View style={styles.detailHandle} />

                            {/* Header */}
                            <View style={styles.detailHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.detailTitle} numberOfLines={2}>{detailJob.title}</Text>
                                    <Text style={styles.detailClinic}>{detailJob.clinic?.clinic_name || 'Clinic'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setDetailJob(null)} style={styles.detailClose}>
                                    <X size={22} color={colors.text.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* Clinic Photo Gallery */}
                            {(detailJob.clinic?.images?.filter(Boolean).length ?? 0) > 0 && (
                                <ScrollView
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.detailPhotoRow}
                                >
                                    {detailJob.clinic.images!.filter(Boolean).map((img, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            activeOpacity={0.9}
                                            onPress={() => {
                                                setLightboxImages(detailJob.clinic.images!.filter(Boolean));
                                                setLightboxIndex(i);
                                                setLightboxVisible(true);
                                            }}
                                        >
                                            <Image
                                                source={{ uri: resolveImageUrl(img) }}
                                                style={styles.detailPhotoImg}
                                                resizeMode="cover"
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                                {/* Pay & Date */}
                                <View style={styles.detailHighlights}>
                                    <View style={styles.highlightItem}>
                                        <Text style={styles.highlightLabel}>Pay</Text>
                                        <Text style={styles.highlightValue}>฿{(detailJob.pay_amount || 0).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.highlightDivider} />
                                    <View style={styles.highlightItem}>
                                        <Text style={styles.highlightLabel}>Date</Text>
                                        <Text style={styles.highlightValue}>{detailJob.work_date || '—'}</Text>
                                    </View>
                                    <View style={styles.highlightDivider} />
                                    <View style={styles.highlightItem}>
                                        <Text style={styles.highlightLabel}>Hours</Text>
                                        <Text style={styles.highlightValue}>{detailJob.start_time}–{detailJob.end_time}</Text>
                                    </View>
                                </View>

                                {/* Location */}
                                {detailJob.clinic?.address && (
                                    <View style={styles.detailRow}>
                                        <MapPin size={16} color={colors.primary.DEFAULT} />
                                        <Text style={styles.detailRowText}>{detailJob.clinic.address}</Text>
                                    </View>
                                )}

                                {/* Specialty */}
                                {detailJob.specialty && (
                                    <View style={styles.detailRow}>
                                        <Briefcase size={16} color={colors.primary.DEFAULT} />
                                        <Text style={styles.detailRowText}>{detailJob.specialty}</Text>
                                    </View>
                                )}

                                {/* Description */}
                                {detailJob.description && (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailSectionTitle}>Job Description</Text>
                                        <Text style={styles.detailDesc}>{detailJob.description}</Text>
                                    </View>
                                )}

                                <View style={{ height: 20 }} />
                            </ScrollView>

                            {/* Actions */}
                            <View style={styles.detailActions}>
                                <TouchableOpacity
                                    style={styles.detailPassBtn}
                                    onPress={() => { handleSwipeLeft(detailJob); setDetailJob(null); }}
                                >
                                    <XCircle size={20} color={colors.semantic.error} />
                                    <Text style={styles.detailPassText}>Pass</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.detailApplyBtn}
                                    onPress={() => { handleSwipeRight(detailJob); setDetailJob(null); }}
                                >
                                    <CheckCircle size={20} color={colors.text.inverse} />
                                    <Text style={styles.detailApplyText}>Apply Now</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </Modal>

            {/* ────────── Lightbox ────────── */}
            <Modal
                visible={lightboxVisible}
                animationType="fade"
                transparent={false}
                onRequestClose={() => setLightboxVisible(false)}
            >
                <View style={styles.lightboxBg}>
                    <View style={styles.lightboxTopBar}>
                        <TouchableOpacity onPress={() => setLightboxVisible(false)}>
                            <X size={26} color="#fff" />
                        </TouchableOpacity>
                        {lightboxImages.length > 1 && (
                            <Text style={styles.lightboxCounter}>
                                {lightboxIndex + 1} / {lightboxImages.length}
                            </Text>
                        )}
                    </View>
                    {lightboxImages[lightboxIndex] ? (
                        <Image
                            source={{ uri: resolveImageUrl(lightboxImages[lightboxIndex]) }}
                            style={styles.lightboxImg}
                            resizeMode="contain"
                        />
                    ) : null}
                    {lightboxIndex > 0 && (
                        <TouchableOpacity
                            style={[styles.lightboxNav, styles.lightboxNavL]}
                            onPress={() => setLightboxIndex(i => i - 1)}
                        >
                            <Text style={styles.lightboxNavTxt}>‹</Text>
                        </TouchableOpacity>
                    )}
                    {lightboxIndex < lightboxImages.length - 1 && (
                        <TouchableOpacity
                            style={[styles.lightboxNav, styles.lightboxNavR]}
                            onPress={() => setLightboxIndex(i => i + 1)}
                        >
                            <Text style={styles.lightboxNavTxt}>›</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Modal>

            {/* ────────── Filter Bottom Sheet ────────── */}
            <Modal visible={showFilter} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={styles.modalOverlay}>
                    <View style={styles.filterSheet}>
                        {/* Sheet Header */}
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Filter Jobs</Text>
                            <TouchableOpacity onPress={() => setShowFilter(false)}>
                                <X size={22} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetBody}>
                            {/* Specialty */}
                            <Text style={styles.filterLabel}>Specialty</Text>
                            <View style={styles.chipRow}>
                                {SPECIALTIES.map(s => (
                                    <TouchableOpacity
                                        key={s.value}
                                        style={[styles.chip, pendingFilters.specialty === s.value && styles.chipActive]}
                                        onPress={() => setPendingFilters(f => ({ ...f, specialty: s.value }))}
                                    >
                                        <Text style={[styles.chipText, pendingFilters.specialty === s.value && styles.chipTextActive]}>
                                            {s.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Search Location */}
                            <Text style={styles.filterLabel}>Search Area</Text>
                            <View style={styles.locationRow}>
                                <TextInput
                                    style={[styles.textInput, { flex: 1 }]}
                                    placeholder='e.g. เชียงใหม่, ภูเก็ต, ขอนแก่น'
                                    placeholderTextColor={colors.text.disabled}
                                    value={locationQuery}
                                    onChangeText={setLocationQuery}
                                    returnKeyType="search"
                                    onSubmitEditing={() => searchLocation(locationQuery)}
                                />
                                <TouchableOpacity
                                    style={styles.searchLocationBtn}
                                    onPress={() => searchLocation(locationQuery)}
                                    disabled={isSearchingLocation}
                                >
                                    {isSearchingLocation ? (
                                        <ActivityIndicator size="small" color={colors.text.inverse} />
                                    ) : (
                                        <MapPin size={16} color={colors.text.inverse} />
                                    )}
                                </TouchableOpacity>
                            </View>
                            {pendingFilters.searchLocation ? (
                                <View style={styles.locationChip}>
                                    <MapPin size={12} color={colors.primary.DEFAULT} />
                                    <Text style={styles.locationChipText}>{pendingFilters.searchLocation}</Text>
                                    <TouchableOpacity onPress={() => {
                                        setPendingFilters(f => ({ ...f, searchLocation: '', searchLat: null, searchLng: null }));
                                        setLocationQuery('');
                                    }}>
                                        <X size={14} color={colors.text.disabled} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={styles.locationHint}>
                                    Using your current GPS location
                                </Text>
                            )}

                            {/* Radius */}
                            <Text style={styles.filterLabel}>Search Radius</Text>
                            <View style={styles.chipRow}>
                                {RADII.map(r => (
                                    <TouchableOpacity
                                        key={r.value}
                                        style={[styles.chip, pendingFilters.radiusKm === r.value && styles.chipActive]}
                                        onPress={() => setPendingFilters(f => ({ ...f, radiusKm: r.value }))}
                                    >
                                        <Text style={[styles.chipText, pendingFilters.radiusKm === r.value && styles.chipTextActive]}>
                                            {r.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Min Pay */}
                            <Text style={styles.filterLabel}>Minimum Pay (฿)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. 1500"
                                placeholderTextColor={colors.text.disabled}
                                value={pendingFilters.minPay}
                                onChangeText={v => setPendingFilters(f => ({ ...f, minPay: v.replace(/[^0-9]/g, '') }))}
                                keyboardType="numeric"
                            />

                            {/* Date */}
                            <DatePickerField
                                label="Work Date"
                                value={pendingFilters.date}
                                onChange={v => setPendingFilters(f => ({ ...f, date: v }))}
                                placeholder="Any date"
                                minDate={new Date().toISOString().split('T')[0]}
                            />
                            {pendingFilters.date ? (
                                <TouchableOpacity onPress={() => setPendingFilters(f => ({ ...f, date: '' }))}>
                                    <Text style={{ fontSize: 13, color: colors.semantic.error, marginTop: -4, marginBottom: spacing.sm }}>Clear date</Text>
                                </TouchableOpacity>
                            ) : null}

                            {/* Sort */}
                            <Text style={styles.filterLabel}>Sort By</Text>
                            <View style={styles.chipRow}>
                                {SORT_OPTIONS.map(o => (
                                    <TouchableOpacity
                                        key={o.value}
                                        style={[styles.chip, pendingFilters.sortBy === o.value && styles.chipActive]}
                                        onPress={() => setPendingFilters(f => ({ ...f, sortBy: o.value }))}
                                    >
                                        <Text style={[styles.chipText, pendingFilters.sortBy === o.value && styles.chipTextActive]}>
                                            {o.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        {/* Action Buttons */}
                        <View style={styles.sheetActions}>
                            <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                                <Text style={styles.resetBtnText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                                <Text style={styles.applyBtnText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loadingText: { color: colors.text.secondary, fontSize: 15 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary.transparent,
        justifyContent: 'center', alignItems: 'center',
    },
    iconBtnActive: { backgroundColor: colors.primary.DEFAULT },
    filterBadge: {
        position: 'absolute', top: -2, right: -2,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: colors.semantic.error,
        justifyContent: 'center', alignItems: 'center',
    },
    filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
    statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, flexWrap: 'wrap' },
    statChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.background.paper,
        paddingHorizontal: spacing.sm, paddingVertical: 4,
        borderRadius: borderRadii.full, ...shadows.sm,
    },
    statText: { fontSize: 12, fontWeight: '600' },
    cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    emptyContainer: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
    emptyIcon: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: colors.background.paper, justifyContent: 'center', alignItems: 'center',
        ...shadows.sm, marginBottom: spacing.sm,
    },
    emptyText: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
    emptySubtext: { fontSize: 14, color: colors.text.secondary, textAlign: 'center' },
    reloadBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs,
        backgroundColor: colors.primary.transparent,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadii.full,
    },
    reloadBtnText: { color: colors.primary.DEFAULT, fontWeight: '600', fontSize: 15 },
    hint: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    hintPass: { color: colors.semantic.error, fontWeight: '600', fontSize: 13 },
    hintCenter: { color: colors.text.disabled, fontSize: 13 },
    hintApply: { color: colors.semantic.success, fontWeight: '600', fontSize: 13 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    filterSheet: {
        backgroundColor: colors.background.paper,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '85%',
    },
    sheetHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    sheetBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    filterLabel: {
        fontSize: 13, fontWeight: '700', color: colors.text.secondary,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md,
    },
    locationRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    searchLocationBtn: {
        width: 44, height: 44, borderRadius: borderRadii.md,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center', alignItems: 'center',
    },
    locationChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.sm, paddingVertical: 6,
        marginTop: spacing.sm, alignSelf: 'flex-start',
    },
    locationChipText: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600' },
    locationHint: { fontSize: 12, color: colors.text.disabled, marginTop: spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 7,
        borderRadius: borderRadii.full, borderWidth: 1.5, borderColor: colors.border.DEFAULT,
        backgroundColor: colors.background.DEFAULT,
    },
    chipActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
    chipTextActive: { color: colors.text.inverse },
    textInput: {
        backgroundColor: colors.background.DEFAULT, borderRadius: borderRadii.md,
        borderWidth: 1.5, borderColor: colors.border.DEFAULT,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
        fontSize: 15, color: colors.text.primary,
    },
    sheetActions: {
        flexDirection: 'row', gap: spacing.md,
        padding: spacing.xl, paddingBottom: 36,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    resetBtn: {
        flex: 1, paddingVertical: 14, borderRadius: borderRadii.lg,
        borderWidth: 1.5, borderColor: colors.border.DEFAULT,
        alignItems: 'center',
    },
    resetBtnText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
    applyBtn: {
        flex: 2, paddingVertical: 14, borderRadius: borderRadii.lg,
        backgroundColor: colors.primary.DEFAULT, alignItems: 'center',
    },
    applyBtnText: { fontSize: 15, fontWeight: '700', color: colors.text.inverse },
    viewDetailsBtn: {
        alignSelf: 'center', marginTop: spacing.sm,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    },
    viewDetailsBtnText: { fontSize: 14, color: colors.primary.DEFAULT, fontWeight: '600', textDecorationLine: 'underline' },
    detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    detailSheet: {
        backgroundColor: colors.background.paper,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '85%',
    },
    detailHandle: {
        width: 40, height: 4, backgroundColor: colors.border.DEFAULT,
        borderRadius: 2, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md,
    },
    detailHeader: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    detailClose: { padding: spacing.xs },
    detailTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
    detailClinic: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
    detailBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    detailHighlights: {
        flexDirection: 'row', backgroundColor: colors.primary.transparent,
        borderRadius: borderRadii.lg, padding: spacing.md, marginBottom: spacing.lg,
    },
    highlightItem: { flex: 1, alignItems: 'center' },
    highlightLabel: { fontSize: 11, color: colors.text.secondary, marginBottom: 2 },
    highlightValue: { fontSize: 15, fontWeight: 'bold', color: colors.primary.DEFAULT },
    highlightDivider: { width: 1, backgroundColor: colors.border.DEFAULT, marginHorizontal: spacing.sm },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
    detailRowText: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 20 },
    detailSection: { marginBottom: spacing.md },
    detailSectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text.disabled, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
    detailDesc: { fontSize: 14, color: colors.text.primary, lineHeight: 22 },
    detailActions: {
        flexDirection: 'row', gap: spacing.md,
        padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    detailPassBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, paddingVertical: spacing.md,
        borderRadius: borderRadii.lg, borderWidth: 1.5, borderColor: colors.semantic.error,
    },
    detailPassText: { fontSize: 15, fontWeight: '700', color: colors.semantic.error },
    detailApplyBtn: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, paddingVertical: spacing.md,
        borderRadius: borderRadii.lg, backgroundColor: colors.primary.DEFAULT,
    },
    detailApplyText: { fontSize: 15, fontWeight: '700', color: colors.text.inverse },
    // Photo gallery in detail modal
    detailPhotoRow: {
        height: 220,
        marginBottom: spacing.sm,
    },
    detailPhotoImg: {
        width: SCREEN_WIDTH,
        height: 220,
    },
    // Lightbox
    lightboxBg: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightboxTopBar: {
        position: 'absolute',
        top: 56,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        zIndex: 10,
    },
    lightboxCounter: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    lightboxImg: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
    lightboxNav: {
        position: 'absolute',
        top: '50%',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightboxNavL: { left: spacing.lg },
    lightboxNavR: { right: spacing.lg },
    lightboxNavTxt: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '300' },
});

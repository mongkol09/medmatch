import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
    User, MapPin, Star, Briefcase, Shield, ChevronRight,
    LogOut, RefreshCw, Bell, CheckCircle
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/common/Button';
import { useAuthStore } from '../../src/store/authStore';
import { api, resolveImageUrl } from '../../src/services/api';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';

const ROLE_LABELS: Record<string, string> = {
    SEEKER: 'Healthcare Provider',
    CLINIC: 'Clinic / Hospital',
    PATIENT: 'Patient',
};

const SPECIALTY_LABELS: Record<string, string> = {
    DENTIST: 'ทันตแพทย์',
    DOCTOR: 'แพทย์ทั่วไป',
    PHARMACIST: 'เภสัชกร',
    NURSE: 'พยาบาล',
    DENTAL_ASSISTANT: 'ผู้ช่วยทันตแพทย์',
    PHYSIOTHERAPIST: 'นักกายภาพบำบัด',
    OTHER: 'อื่นๆ',
};

export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const insets = useSafeAreaInsets();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Use dedicated unread-count endpoint for accuracy
        api.get('/notifications/unread-count').then(res => {
            setUnreadCount(res.data?.count ?? 0);
        }).catch(() => {});
    }, []);

    // Re-fetch profile every time this screen is focused (e.g. returning from Edit Profile)
    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [user?.currentRole])
    );

    const fetchProfile = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            let endpoint = '';
            if (user?.currentRole === 'SEEKER') endpoint = '/profile/seeker/me';
            else if (user?.currentRole === 'CLINIC') endpoint = '/profile/clinic/me';
            else if (user?.currentRole === 'PATIENT') endpoint = '/profile/patient/me';

            if (endpoint) {
                const res = await api.get(endpoint);
                setProfile(res.data);
            }
        } catch {
            setProfile(null);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: () => logout() },
        ]);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => { setIsRefreshing(true); fetchProfile(true); }}
                    tintColor={colors.primary.DEFAULT}
                />
            }
        >
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.avatarContainer}>
                    {(profile?.profile_image_url || (profile?.images && profile.images.length > 0)) ? (
                        <Image source={{ uri: resolveImageUrl(profile.profile_image_url || profile.images[0]) }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <User size={40} color={colors.text.disabled} />
                        </View>
                    )}
                    {profile?.is_verified && (
                        <View style={styles.verifiedBadge}>
                            <CheckCircle size={16} color={colors.background.paper} fill={colors.secondary.DEFAULT} />
                        </View>
                    )}
                </View>

                <View style={styles.headerInfo}>
                    <Text style={styles.nameText}>
                        {profile?.full_name || profile?.clinic_name || user?.email?.split('@')[0] || 'User'}
                    </Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{ROLE_LABELS[user?.currentRole || 'PATIENT']}</Text>
                    </View>
                    {profile?.specialty && (
                        <Text style={styles.specialtyText}>
                            {SPECIALTY_LABELS[profile.specialty] || profile.specialty}
                        </Text>
                    )}
                    {profile?.average_rating != null && (
                        <View style={styles.ratingRow}>
                            <Star size={14} color={colors.semantic.warning} fill={colors.semantic.warning} />
                            <Text style={styles.ratingText}>
                                {profile.average_rating.toFixed(1)} ({profile.review_count || 0} reviews)
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Profile Not Set Up */}
            {!profile && (
                <View style={styles.setupCard}>
                    <Text style={styles.setupTitle}>Complete your profile</Text>
                    <Text style={styles.setupDesc}>
                        {user?.currentRole === 'SEEKER'
                            ? 'Add your credentials to start finding part-time jobs.'
                            : user?.currentRole === 'CLINIC'
                            ? 'Set up your clinic profile to post jobs and accept bookings.'
                            : 'Complete your patient profile to book appointments.'}
                    </Text>
                    <Button
                        title="Set Up Profile"
                        onPress={() => {
                            if (user?.currentRole === 'SEEKER') router.push('/(app)/seeker-profile/edit' as any);
                            else if (user?.currentRole === 'CLINIC') router.push('/(app)/clinic-profile/edit' as any);
                            else router.push('/(app)/patient-profile/edit' as any);
                        }}
                        style={{ marginTop: spacing.md }}
                    />
                </View>
            )}

            {/* Seeker-specific */}
            {user?.currentRole === 'SEEKER' && profile && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Professional Info</Text>
                    {profile.license_number && (
                        <InfoRow icon={<Shield size={18} color={colors.primary.DEFAULT} />}
                            label="License Number" value={profile.license_number} />
                    )}
                    {profile.years_experience != null && (
                        <InfoRow icon={<Briefcase size={18} color={colors.primary.DEFAULT} />}
                            label="Experience" value={`${profile.years_experience} years`} />
                    )}
                    {profile.bio && (
                        <View style={styles.bioBox}>
                            <Text style={styles.bioText}>{profile.bio}</Text>
                        </View>
                    )}
                    <MenuItem label="Edit Profile" onPress={() => router.push('/(app)/seeker-profile/edit' as any)} />
                    <MenuItem label="Upload License / Verification" onPress={() => router.push('/(app)/verification' as any)} />
                    <MenuItem label="My Work Calendar" onPress={() => router.push('/(app)/calendar' as any)} />
                    <MenuItem label="My Applications" onPress={() => router.push('/(app)/my-applications' as any)} />
                    <MenuItem label="Income Summary" onPress={() => router.push('/(app)/income' as any)} />
                </View>
            )}

            {/* Clinic-specific */}
            {user?.currentRole === 'CLINIC' && profile && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinic Info</Text>
                    {profile.address && (
                        <InfoRow icon={<MapPin size={18} color={colors.primary.DEFAULT} />}
                            label="Address" value={profile.address} />
                    )}
                    {profile.chair_count != null && (
                        <InfoRow icon={<Briefcase size={18} color={colors.primary.DEFAULT} />}
                            label="Dental Chairs" value={`${profile.chair_count} chairs`} />
                    )}
                    <MenuItem label="Edit Clinic Profile" onPress={() => router.push('/(app)/clinic-profile/edit' as any)} />
                    <MenuItem label="Post a Job" onPress={() => router.push('/(app)/jobs/post' as any)} />
                    <MenuItem label="Today's Appointments" onPress={() => router.push('/(app)/booking/clinic-today' as any)} />
                    <MenuItem label="Patient Records" onPress={() => router.push('/(app)/patient-records' as any)} />
                    <MenuItem label="Accounting" onPress={() => router.push('/(app)/accounting' as any)} />
                </View>
            )}

            {/* Patient-specific */}
            {user?.currentRole === 'PATIENT' && profile && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Health Info</Text>
                    {profile.blood_type && (
                        <InfoRow icon={<Shield size={18} color={colors.primary.DEFAULT} />}
                            label="Blood Type" value={profile.blood_type} />
                    )}
                    {profile.allergies && (
                        <InfoRow icon={<Shield size={18} color={colors.semantic.warning} />}
                            label="Allergies" value={profile.allergies} />
                    )}
                    <MenuItem label="Edit Profile" onPress={() => router.push('/(app)/patient-profile/edit' as any)} />
                    <MenuItem label="Treatment History" onPress={() => router.push('/(app)/treatment-history' as any)} />
                    <MenuItem label="Saved Clinics" onPress={() => router.push('/(app)/favorites' as any)} />
                </View>
            )}

            {/* Account Menu */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>

                <MenuItem label="Settings" onPress={() => router.push('/(app)/settings' as any)} />

                <TouchableOpacity style={styles.menuItem}
                    onPress={() => router.push('/(app)/notifications' as any)}>
                    <Bell size={18} color={colors.primary.DEFAULT} />
                    <Text style={[styles.menuText, { marginLeft: spacing.sm, flex: 1 }]}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.notifBadge}>
                            <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                    )}
                    <ChevronRight size={18} color={colors.text.disabled} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}
                    onPress={() => router.push('/(app)/switch-role' as any)}>
                    <RefreshCw size={18} color={colors.primary.DEFAULT} />
                    <Text style={[styles.menuText, { marginLeft: spacing.sm, flex: 1 }]}>Switch Role</Text>
                    <View style={styles.currentRolePill}>
                        <Text style={styles.currentRolePillText}>{user?.currentRole}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.text.disabled} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, { marginTop: spacing.xs }]} onPress={handleLogout}>
                    <LogOut size={18} color={colors.semantic.error} />
                    <Text style={[styles.menuText, { marginLeft: spacing.sm, color: colors.semantic.error }]}>
                        Log Out
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            {icon}
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <Text style={[styles.menuText, { flex: 1 }]}>{label}</Text>
            <ChevronRight size={18} color={colors.text.disabled} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { padding: spacing.md, paddingBottom: 80 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT },

    headerCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.paper,
        borderRadius: borderRadii.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.md,
    },
    avatarContainer: { position: 'relative', marginRight: spacing.md },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.border.DEFAULT },
    avatarPlaceholder: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    verifiedBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: colors.secondary.DEFAULT, borderRadius: 10, padding: 2,
    },
    headerInfo: { flex: 1 },
    nameText: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.xs },
    roleBadge: {
        alignSelf: 'flex-start', backgroundColor: colors.primary.transparent,
        borderRadius: borderRadii.full, paddingHorizontal: spacing.sm, paddingVertical: 2, marginBottom: spacing.xs,
    },
    roleText: { fontSize: 12, color: colors.primary.DEFAULT, fontWeight: '600' },
    specialtyText: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing.xs },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 13, color: colors.text.secondary },

    setupCard: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
        borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    setupTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.xs },
    setupDesc: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },

    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
    infoLabel: { fontSize: 12, color: colors.text.disabled, marginBottom: 2 },
    infoValue: { fontSize: 15, color: colors.text.primary },
    bioBox: {
        backgroundColor: colors.background.DEFAULT, borderRadius: borderRadii.md,
        padding: spacing.md, marginBottom: spacing.md,
    },
    bioText: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    menuText: { fontSize: 15, color: colors.text.primary },
    currentRolePill: {
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.sm, paddingVertical: 2, marginRight: spacing.xs,
    },
    currentRolePillText: { fontSize: 11, color: colors.primary.DEFAULT, fontWeight: '600' },
    notifBadge: {
        backgroundColor: colors.semantic.error,
        borderRadius: 10, minWidth: 20, height: 20,
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 5, marginRight: spacing.xs,
    },
    notifBadgeText: { color: colors.text.inverse, fontSize: 11, fontWeight: 'bold' },
});

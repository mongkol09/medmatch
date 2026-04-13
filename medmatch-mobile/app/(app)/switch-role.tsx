import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, User, Building2, Stethoscope, CheckCircle } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

type Role = 'SEEKER' | 'CLINIC' | 'PATIENT';

interface RoleOption {
    value: Role;
    label: string;
    subtitle: string;
    icon: any;
    color: string;
}

const ROLE_OPTIONS: RoleOption[] = [
    {
        value: 'PATIENT',
        label: 'Patient',
        subtitle: 'Search clinics, book appointments, upload payment slips',
        icon: User,
        color: '#3B82F6',
    },
    {
        value: 'SEEKER',
        label: 'Healthcare Provider',
        subtitle: 'Browse part-time jobs, manage your work calendar',
        icon: Stethoscope,
        color: '#10B981',
    },
    {
        value: 'CLINIC',
        label: 'Clinic / Hospital',
        subtitle: 'Post jobs, manage bookings, review applicants',
        icon: Building2,
        color: '#8B5CF6',
    },
];

export default function SwitchRoleScreen() {
    const router = useRouter();
    const { user, updateUser } = useAuthStore();
    const [isSwitching, setIsSwitching] = useState<Role | null>(null);

    const handleSwitch = async (role: Role) => {
        if (role === user?.currentRole) {
            router.back();
            return;
        }
        setIsSwitching(role);
        try {
            const res = await api.post('/auth/switch-role', { role });
            updateUser({ currentRole: role });
            Alert.alert(
                'Switched!',
                `You are now viewing as ${ROLE_OPTIONS.find((r) => r.value === role)?.label}.`,
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Could not switch role.');
        } finally {
            setIsSwitching(null);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Switch Role</Text>
                <View style={{ width: 26 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.subtitle}>
                    MedMatch is a multi-role platform. Switch between roles to access different features.
                </Text>

                {ROLE_OPTIONS.map((opt) => {
                    const isActive = user?.currentRole === opt.value;
                    const isProcessing = isSwitching === opt.value;
                    const IconComp = opt.icon;

                    return (
                        <TouchableOpacity
                            key={opt.value}
                            style={[styles.roleCard, isActive && styles.roleCardActive]}
                            onPress={() => handleSwitch(opt.value)}
                            activeOpacity={0.7}
                            disabled={isSwitching !== null}
                        >
                            <View style={[styles.iconBox, { backgroundColor: opt.color + '18' }]}>
                                <IconComp size={26} color={opt.color} />
                            </View>

                            <View style={styles.roleInfo}>
                                <Text style={[styles.roleLabel, isActive && { color: opt.color }]}>
                                    {opt.label}
                                </Text>
                                <Text style={styles.roleSub}>{opt.subtitle}</Text>
                            </View>

                            {isProcessing ? (
                                <ActivityIndicator size="small" color={opt.color} />
                            ) : isActive ? (
                                <CheckCircle size={22} color={opt.color} fill={opt.color} />
                            ) : (
                                <View style={styles.selectCircle} />
                            )}
                        </TouchableOpacity>
                    );
                })}

                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        Your data and bookings are kept separately for each role. Switching roles does not delete any information.
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    content: { padding: spacing.lg },
    subtitle: {
        fontSize: 14, color: colors.text.secondary, lineHeight: 20,
        marginBottom: spacing.xl, textAlign: 'center',
    },
    roleCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
        borderWidth: 2, borderColor: 'transparent',
    },
    roleCardActive: {
        borderColor: colors.primary.DEFAULT,
        backgroundColor: colors.primary.transparent + '60',
    },
    iconBox: {
        width: 52, height: 52, borderRadius: borderRadii.md,
        justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
    },
    roleInfo: { flex: 1 },
    roleLabel: { fontSize: 16, fontWeight: 'bold', color: colors.text.primary, marginBottom: 4 },
    roleSub: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
    selectCircle: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: colors.border.DEFAULT,
    },
    infoBox: {
        backgroundColor: colors.border.light, borderRadius: borderRadii.md,
        padding: spacing.md, marginTop: spacing.md,
    },
    infoText: { fontSize: 13, color: colors.text.secondary, lineHeight: 18, textAlign: 'center' },
});

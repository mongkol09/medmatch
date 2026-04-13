import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Lock, Trash2, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/common/Button';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';

export default function SettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuthStore();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChanging, setIsChanging] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            Alert.alert('Required', 'Please fill in all password fields.');
            return;
        }
        if (newPassword.length < 8) {
            Alert.alert('Too Short', 'New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Mismatch', 'New passwords do not match.');
            return;
        }
        setIsChanging(true);
        try {
            await api.patch('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            });
            Alert.alert('Success', 'Your password has been changed.', [
                { text: 'OK', onPress: () => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); } },
            ]);
        } catch (e: any) {
            Alert.alert('Failed', e.response?.data?.message || 'Could not change password.');
        } finally {
            setIsChanging(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all data. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete My Account',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Final Confirmation',
                            'Are you absolutely sure? All your data will be permanently deleted.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Yes, Delete Everything',
                                    style: 'destructive',
                                    onPress: async () => {
                                        setIsDeleting(true);
                                        try {
                                            await api.delete('/auth/account');
                                            Alert.alert('Account Deleted', 'Your account has been permanently deleted.', [
                                                { text: 'OK', onPress: () => logout() },
                                            ]);
                                        } catch (e: any) {
                                            Alert.alert('Failed', e.response?.data?.message || 'Could not delete account.');
                                        } finally {
                                            setIsDeleting(false);
                                        }
                                    },
                                },
                            ],
                        );
                    },
                },
            ],
        );
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                {/* Account Info */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Shield size={18} color={colors.primary.DEFAULT} />
                        <Text style={styles.sectionTitle}>Account</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{user?.email || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Role</Text>
                        <Text style={styles.infoValue}>{user?.currentRole || '—'}</Text>
                    </View>
                </View>

                {/* Change Password */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Lock size={18} color={colors.primary.DEFAULT} />
                        <Text style={styles.sectionTitle}>Change Password</Text>
                    </View>

                    <Text style={styles.inputLabel}>Current Password</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        placeholder="Enter current password"
                        placeholderTextColor={colors.text.disabled}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                    />

                    <Text style={styles.inputLabel}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        placeholder="Minimum 8 characters"
                        placeholderTextColor={colors.text.disabled}
                        value={newPassword}
                        onChangeText={setNewPassword}
                    />

                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        placeholder="Re-enter new password"
                        placeholderTextColor={colors.text.disabled}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />

                    <Button
                        title="Change Password"
                        onPress={handleChangePassword}
                        isLoading={isChanging}
                        disabled={!currentPassword || !newPassword || !confirmPassword}
                        style={{ marginTop: spacing.md }}
                    />
                </View>

                {/* Danger Zone */}
                <View style={[styles.section, styles.dangerSection]}>
                    <View style={styles.sectionHeader}>
                        <Trash2 size={18} color={colors.semantic.error} />
                        <Text style={[styles.sectionTitle, { color: colors.semantic.error }]}>Danger Zone</Text>
                    </View>
                    <Text style={styles.dangerDesc}>
                        Permanently delete your account, profile data, booking history, and all associated information. This action cannot be undone.
                    </Text>
                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={handleDeleteAccount}
                        disabled={isDeleting}
                    >
                        <Trash2 size={16} color={colors.semantic.error} />
                        <Text style={styles.deleteBtnText}>
                            {isDeleting ? 'Deleting...' : 'Delete My Account'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    infoLabel: { fontSize: 14, color: colors.text.secondary },
    infoValue: { fontSize: 14, color: colors.text.primary, fontWeight: '500' },
    inputLabel: {
        fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.xs, marginTop: spacing.sm,
    },
    input: {
        backgroundColor: colors.background.DEFAULT, borderRadius: borderRadii.md,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        fontSize: 15, color: colors.text.primary,
        borderWidth: 1, borderColor: colors.border.DEFAULT,
    },
    dangerSection: { borderWidth: 1, borderColor: colors.semantic.error + '30' },
    dangerDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 18, marginBottom: spacing.md },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        paddingVertical: spacing.md, borderRadius: borderRadii.md,
        borderWidth: 1.5, borderColor: colors.semantic.error,
    },
    deleteBtnText: { fontSize: 14, fontWeight: '600', color: colors.semantic.error },
});

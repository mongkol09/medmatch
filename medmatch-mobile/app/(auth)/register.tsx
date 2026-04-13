import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { colors, spacing, borderRadii } from '../../src/theme';
import { api } from '../../src/services/api';
import { Mail, Lock, User, CheckCircle2, Circle } from 'lucide-react-native';

export default function RegisterScreen() {
    const router = useRouter();

    const [role, setRole] = useState<'SEEKER' | 'CLINIC' | 'PATIENT'>('PATIENT');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/auth/register', { email, password, role });
            const { userId } = response.data;

            router.push({
                pathname: '/(auth)/otp-verify',
                params: { userId, email },
            });
        } catch (error: any) {
            const msg = error.response?.data?.message;
            Alert.alert(
                'Registration Failed',
                Array.isArray(msg) ? msg.join('\n') : (msg || 'Something went wrong.')
            );
        } finally {
            setIsLoading(false);
        }
    };

    const RoleOption = ({ title, value, description }: { title: string; value: any; description: string }) => (
        <TouchableOpacity
            style={[styles.roleOption, role === value && styles.roleOptionSelected]}
            onPress={() => setRole(value)}
            activeOpacity={0.7}
        >
            <View style={styles.roleHeader}>
                {role === value ? <CheckCircle2 size={20} color={colors.primary.DEFAULT} /> : <Circle size={20} color={colors.border.DEFAULT} />}
                <Text style={[styles.roleTitle, role === value && styles.roleTitleSelected]}>{title}</Text>
            </View>
            <Text style={styles.roleDesc}>{description}</Text>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join MedMatch today</Text>
                </View>

                <View style={styles.rolesContainer}>
                    <RoleOption
                        title="Patient"
                        value="PATIENT"
                        description="Find clinics & book appointments"
                    />
                    <View style={{ height: 12 }} />
                    <RoleOption
                        title="Healthcare Provider"
                        value="SEEKER"
                        description="Find part-time work & jobs"
                    />
                    <View style={{ height: 12 }} />
                    <RoleOption
                        title="Clinic / Hospital"
                        value="CLINIC"
                        description="Post jobs & manage bookings"
                    />
                </View>

                <View style={styles.card}>
                    <Input
                        label="Email"
                        placeholder="you@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        leftIcon={<Mail size={20} color={colors.text.disabled} />}
                    />

                    <Input
                        label="Password"
                        placeholder="Create a secure password"
                        isPassword
                        value={password}
                        onChangeText={setPassword}
                        leftIcon={<Lock size={20} color={colors.text.disabled} />}
                    />

                    <Button
                        title="Continue"
                        onPress={handleRegister}
                        isLoading={isLoading}
                        style={styles.registerBtn}
                    />

                    <View style={styles.loginContainer}>
                        <Text style={styles.loginText}>Already have an account? </Text>
                        <Text
                            style={[styles.linkText, { fontWeight: '600' }]}
                            onPress={() => router.back()}
                        >
                            Log In
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EFF6FF',
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.xl,
        paddingTop: 56,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        letterSpacing: -1,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    rolesContainer: {
        marginBottom: spacing.lg,
    },
    roleOption: {
        borderWidth: 1.5,
        borderColor: colors.border.DEFAULT,
        borderRadius: borderRadii.lg,
        padding: spacing.md,
        backgroundColor: colors.background.paper,
    },
    roleOptionSelected: {
        borderColor: colors.primary.DEFAULT,
        backgroundColor: '#EFF6FF',
    },
    roleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    roleTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text.primary,
    },
    roleTitleSelected: {
        color: colors.primary.DEFAULT,
    },
    roleDesc: {
        fontSize: 13,
        color: colors.text.secondary,
        paddingLeft: 28,
    },
    card: {
        backgroundColor: colors.background.paper,
        padding: spacing.xl,
        borderRadius: borderRadii.xl,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    linkText: {
        color: colors.primary.DEFAULT,
        fontSize: 14,
        fontWeight: '600',
    },
    registerBtn: {
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    loginText: {
        color: colors.text.secondary,
        fontSize: 14,
    },
});

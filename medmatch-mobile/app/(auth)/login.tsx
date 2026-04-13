import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { colors, spacing, borderRadii } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { Mail, Lock, Fingerprint } from 'lucide-react-native';
import { registerForPushNotifications } from '../../src/services/pushNotifications';

export default function LoginScreen() {
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);

    useEffect(() => {
        // Check if the device has biometric hardware and if the user has enrolled
        (async () => {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            setIsBiometricSupported(compatible && enrolled);
        })();
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });

            const { user, accessToken, refreshToken } = response.data;
            setAuth(user, accessToken, refreshToken);

            // Save refresh token securely for future biometric logins
            await SecureStore.setItemAsync('secureRefreshToken', refreshToken);

            // Register for push notifications (non-blocking)
            registerForPushNotifications().catch(() => {});

            // Navigate based on role
            const role = user?.currentRole || user?.role;
            if (role === 'CLINIC') router.replace('/(app)/clinic-dashboard');
            else if (role === 'SEEKER') router.replace('/(app)/jobs');
            else router.replace('/(app)/home');

        } catch (error: any) {
            const msg = error.response?.data?.message;
            Alert.alert(
                'Login Failed',
                Array.isArray(msg) ? msg.join('\n') : (msg || 'Invalid credentials or server error.')
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleBiometricAuth = async () => {
        try {
            const biometricAuth = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Login to MedMatch',
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
            });

            if (biometricAuth.success) {
                const savedToken = await SecureStore.getItemAsync('secureRefreshToken');

                if (!savedToken) {
                    Alert.alert('Notice', 'No previous login found. Please login with email first.');
                    return;
                }

                setIsLoading(true);
                try {
                    const response = await api.post('/auth/refresh', { refreshToken: savedToken });
                    const { user, accessToken, refreshToken } = response.data;

                    await SecureStore.setItemAsync('secureRefreshToken', refreshToken);
                    setAuth(user, accessToken, refreshToken);

                    // Register for push notifications (non-blocking)
                    registerForPushNotifications().catch(() => {});
                    // Navigation handled by index.tsx role-based routing
                } catch {
                    Alert.alert('Session Expired', 'Please login with your email and password.');
                    await SecureStore.deleteItemAsync('secureRefreshToken');
                } finally {
                    setIsLoading(false);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Biometric authentication error occurred.');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>MedMatch</Text>
                    <Text style={styles.subtitle}>Welcome back</Text>
                </View>

                <View style={styles.card}>
                    <Input
                        label="Email"
                        placeholder="Enter your email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        leftIcon={<Mail size={20} color={colors.text.disabled} />}
                    />

                    <Input
                        label="Password"
                        placeholder="Enter your password"
                        isPassword
                        value={password}
                        onChangeText={setPassword}
                        leftIcon={<Lock size={20} color={colors.text.disabled} />}
                    />

                    <View style={styles.forgotPassword}>
                        <Text
                            style={styles.linkText}
                            onPress={() => Alert.alert('Reset Password', 'Please contact support at support@medmatch.app to reset your password.')}
                        >Forgot Password?</Text>
                    </View>

                    <Button
                        title="Log In"
                        onPress={handleLogin}
                        isLoading={isLoading}
                        style={styles.loginBtn}
                    />

                    {isBiometricSupported && (
                        <Button
                            title="Face ID / Touch ID"
                            variant="outline"
                            leftIcon={<Fingerprint size={20} color={colors.primary.DEFAULT} />}
                            onPress={handleBiometricAuth}
                            style={styles.biometricBtn}
                        />
                    )}

                    <View style={styles.registerContainer}>
                        <Text style={styles.registerText}>Don't have an account? </Text>
                        <Text
                            style={[styles.linkText, { fontWeight: '600' }]}
                            onPress={() => router.push('/(auth)/register')}
                        >
                            Sign Up
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
        justifyContent: 'center',
        padding: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
        marginTop: spacing.xs,
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
    forgotPassword: {
        alignItems: 'flex-end',
        marginBottom: spacing.lg,
        marginTop: -spacing.sm,
    },
    linkText: {
        color: colors.primary.DEFAULT,
        fontSize: 14,
        fontWeight: '500',
    },
    loginBtn: {
        marginBottom: spacing.md,
    },
    biometricBtn: {
        marginBottom: spacing.xl,
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.sm,
    },
    registerText: {
        color: colors.text.secondary,
        fontSize: 14,
    },
});

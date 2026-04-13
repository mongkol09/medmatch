import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    TextInput,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/common/Button';
import { colors, spacing, borderRadii } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

const RESEND_COOLDOWN = 60; // seconds

export default function OtpVerifyScreen() {
    const router = useRouter();
    const { userId, phone, email } = useLocalSearchParams<{
        userId: string;
        phone?: string;
        email?: string;
    }>();
    const setAuth = useAuthStore((s) => s.setAuth);

    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    const startCooldown = () => {
        setCooldown(RESEND_COOLDOWN);
        cooldownRef.current = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };
    // Create refs outside the array map to comply with hooks rules
    const ref0 = useRef<TextInput>(null);
    const ref1 = useRef<TextInput>(null);
    const ref2 = useRef<TextInput>(null);
    const ref3 = useRef<TextInput>(null);
    const ref4 = useRef<TextInput>(null);
    const ref5 = useRef<TextInput>(null);
    const inputRefs = [ref0, ref1, ref2, ref3, ref4, ref5];

    const handleChange = (val: string, idx: number) => {
        const sanitized = val.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[idx] = sanitized;
        setDigits(next);
        if (sanitized && idx < 5) inputRefs[idx + 1].current?.focus();
        if (!sanitized && idx > 0) inputRefs[idx - 1].current?.focus();
    };

    const handleVerify = async () => {
        const code = digits.join('');
        if (code.length < 6) {
            Alert.alert('Error', 'Please enter the 6-digit verification code');
            return;
        }
        setIsLoading(true);
        try {
            const res = await api.post('/auth/verify-otp', { userId, code });
            const { user, accessToken, refreshToken } = res.data;
            setAuth(user, accessToken, refreshToken);
            router.replace('/(app)/home');
        } catch (err: any) {
            Alert.alert(
                'Verification Failed',
                err.response?.data?.message || 'Incorrect or expired code. Please try again.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        try {
            await api.post('/auth/send-otp', { userId });
            Alert.alert('Code sent', 'A new verification code has been sent.');
            startCooldown();
        } catch {
            Alert.alert('Error', 'Could not resend code. Please try again later.');
        }
    };

    const contactLabel = phone || email || 'your contact';

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.title}>Verify Account</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code sent to{'\n'}
                        <Text style={styles.contactLabel}>{contactLabel}</Text>
                    </Text>
                </View>

                {/* OTP Input Row */}
                <View style={styles.otpRow}>
                    {digits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={inputRefs[i]}
                            style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                            value={digit}
                            onChangeText={(v) => handleChange(v, i)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                            autoFocus={i === 0}
                        />
                    ))}
                </View>

                <Button
                    title="Verify"
                    onPress={handleVerify}
                    isLoading={isLoading}
                    style={styles.btn}
                />

                <View style={styles.resendRow}>
                    <Text style={styles.resendText}>Didn't receive the code? </Text>
                    <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
                        <Text style={[styles.resendLink, cooldown > 0 && styles.resendDisabled]}>
                            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.DEFAULT,
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    contactLabel: {
        fontWeight: '600',
        color: colors.text.primary,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing['2xl'],
    },
    otpBox: {
        width: 48,
        height: 56,
        borderWidth: 1.5,
        borderColor: colors.border.DEFAULT,
        borderRadius: borderRadii.md,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text.primary,
        backgroundColor: colors.background.paper,
    },
    otpBoxFilled: {
        borderColor: colors.primary.DEFAULT,
        backgroundColor: colors.primary.transparent,
    },
    btn: {
        marginBottom: spacing.xl,
    },
    resendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resendText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    resendLink: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary.DEFAULT,
    },
    resendDisabled: {
        color: colors.text.disabled,
    },
});

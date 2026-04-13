import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { Button } from '../../../src/components/common/Button';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, uploadFile } from '../../../src/services/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PENDING_PAYMENT: { label: 'Awaiting Payment', color: colors.semantic.warning, icon: Clock },
    SLIP_UPLOADED:   { label: 'Slip Uploaded — Verifying', color: colors.semantic.info, icon: Clock },
    PAYMENT_VERIFIED:{ label: 'Payment Verified', color: colors.semantic.success, icon: CheckCircle },
    CANCELLED:       { label: 'Cancelled', color: colors.semantic.error, icon: AlertCircle },
    CONFIRMED:       { label: 'Confirmed', color: colors.secondary.DEFAULT, icon: CheckCircle },
};

export default function PaymentScreen() {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const router = useRouter();

    const [booking, setBooking] = useState<any>(null);
    const [slipImage, setSlipImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (bookingId && bookingId !== 'undefined') fetchBooking();
    }, [bookingId]);

    const fetchBooking = async () => {
        try {
            const res = await api.get(`/booking/${bookingId}`);
            setBooking(res.data);
        } catch {
            Alert.alert('Error', 'Could not load booking details.', [
                { text: 'Go Back', onPress: () => router.back() },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePickSlip = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Please allow access to your photo library.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) {
            setSlipImage(result.assets[0].uri);
        }
    };

    const handleTakeSlip = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Please allow camera access.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.85,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) {
            setSlipImage(result.assets[0].uri);
        }
    };

    const handleUploadSlip = async () => {
        if (!slipImage) return;
        setIsUploading(true);
        try {
            await uploadFile(
                '/payments/upload-slip',
                slipImage,
                'slip',
                'payment_slip.jpg',
                'image/jpeg',
                { bookingId, amount: String(booking?.amount ?? 0) },
            );

            Alert.alert('Uploaded!', 'Your payment slip has been submitted for verification.', [
                { text: 'OK', onPress: () => fetchBooking() },
            ]);
        } catch (err: any) {
            Alert.alert('Upload Failed', err.response?.data?.message || 'Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    if (!booking) return null;

    const statusConf = STATUS_CONFIG[booking.payment_status] || STATUS_CONFIG['PENDING_PAYMENT'];
    const StatusIcon = statusConf.icon;
    const isPaid = ['PAYMENT_VERIFIED', 'CONFIRMED'].includes(booking.payment_status);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking & Payment</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: statusConf.color + '20' }]}>
                    <StatusIcon size={20} color={statusConf.color} />
                    <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
                </View>

                {/* Booking Summary */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Booking Summary</Text>
                    <SummaryRow label="Clinic" value={booking.clinic?.clinic_name || '—'} />
                    <SummaryRow label="Date" value={booking.date || '—'} />
                    <SummaryRow label="Time" value={booking.time_slot || '—'} />
                    <SummaryRow label="Booking ID" value={`#${bookingId.slice(0, 8).toUpperCase()}`} />
                    <View style={styles.divider} />
                    <SummaryRow
                        label="Amount Due"
                        value={booking.amount ? `฿${booking.amount.toLocaleString()}` : '~฿500'}
                        bold
                    />
                </View>

                {/* Payment Instructions */}
                {!isPaid && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Payment Instructions</Text>
                        <Text style={styles.instructionText}>
                            Please transfer to the clinic's bank account and upload your payment slip below.
                        </Text>
                        <View style={styles.bankInfo}>
                            <View style={styles.bankRow}>
                                <Text style={styles.bankLabel}>Bank</Text>
                                <Text style={styles.bankValue}>{booking.clinic?.bank_name || 'Kasikorn Bank'}</Text>
                            </View>
                            <View style={styles.bankRow}>
                                <Text style={styles.bankLabel}>Account</Text>
                                <Text style={styles.bankValue}>{booking.clinic?.bank_account || '123-4-56789-0'}</Text>
                            </View>
                            <View style={styles.bankRow}>
                                <Text style={styles.bankLabel}>Name</Text>
                                <Text style={styles.bankValue}>{booking.clinic?.clinic_name || '—'}</Text>
                            </View>
                            <View style={styles.bankRow}>
                                <Text style={styles.bankLabel}>Amount</Text>
                                <Text style={[styles.bankValue, { color: colors.primary.DEFAULT, fontWeight: 'bold' }]}>
                                    {booking.amount ? `฿${booking.amount.toLocaleString()}` : '~฿500'}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Slip Upload */}
                {!isPaid && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Upload Payment Slip</Text>

                        {slipImage ? (
                            <View style={styles.slipPreviewWrapper}>
                                <Image source={{ uri: slipImage }} style={styles.slipPreview} resizeMode="contain" />
                                <TouchableOpacity style={styles.changeSlipBtn} onPress={handlePickSlip}>
                                    <Text style={styles.changeSlipText}>Change Image</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.uploadArea}>
                                <Upload size={32} color={colors.border.DEFAULT} />
                                <Text style={styles.uploadTitle}>No slip selected</Text>
                                <Text style={styles.uploadDesc}>Take a photo or choose from your gallery</Text>
                                <View style={styles.uploadButtons}>
                                    <Button
                                        title="Camera"
                                        variant="outline"
                                        size="sm"
                                        onPress={handleTakeSlip}
                                        style={{ flex: 1 }}
                                    />
                                    <Button
                                        title="Gallery"
                                        variant="outline"
                                        size="sm"
                                        onPress={handlePickSlip}
                                        style={{ flex: 1 }}
                                    />
                                </View>
                            </View>
                        )}

                        {slipImage && (
                            <Button
                                title="Submit Slip"
                                onPress={handleUploadSlip}
                                isLoading={isUploading}
                                style={{ marginTop: spacing.md }}
                            />
                        )}
                    </View>
                )}

                {/* Already Paid */}
                {isPaid && (
                    <View style={[styles.card, styles.successCard]}>
                        <CheckCircle size={36} color={colors.semantic.success} />
                        <Text style={styles.successTitle}>Payment Confirmed</Text>
                        <Text style={styles.successDesc}>Your booking is confirmed. See you at the clinic!</Text>
                        <Button
                            title="Write a Review"
                            variant="outline"
                            onPress={() => router.push(`/(app)/review/${bookingId}` as any)}
                            style={{ marginTop: spacing.md }}
                        />
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={[styles.summaryValue, bold && { fontWeight: 'bold', fontSize: 16, color: colors.primary.DEFAULT }]}>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    content: { padding: spacing.md },

    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        borderRadius: borderRadii.md, padding: spacing.md, marginBottom: spacing.md,
    },
    statusText: { fontSize: 15, fontWeight: '600' },

    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    summaryLabel: { fontSize: 14, color: colors.text.secondary },
    summaryValue: { fontSize: 14, color: colors.text.primary },
    divider: { height: 1, backgroundColor: colors.border.DEFAULT, marginVertical: spacing.sm },

    instructionText: { fontSize: 14, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.md },
    bankInfo: { backgroundColor: colors.background.DEFAULT, borderRadius: borderRadii.md, padding: spacing.md },
    bankRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    bankLabel: { fontSize: 13, color: colors.text.secondary },
    bankValue: { fontSize: 13, color: colors.text.primary },

    uploadArea: {
        alignItems: 'center', padding: spacing.xl,
        borderWidth: 2, borderColor: colors.border.DEFAULT, borderStyle: 'dashed',
        borderRadius: borderRadii.lg,
    },
    uploadTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    uploadDesc: { fontSize: 13, color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.lg },
    uploadButtons: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
    slipPreviewWrapper: { alignItems: 'center' },
    slipPreview: { width: '100%', height: 240, borderRadius: borderRadii.md, backgroundColor: colors.border.light },
    changeSlipBtn: { marginTop: spacing.sm, padding: spacing.sm },
    changeSlipText: { color: colors.primary.DEFAULT, fontSize: 14, fontWeight: '600' },

    successCard: { alignItems: 'center', paddingVertical: spacing.xl },
    successTitle: { fontSize: 18, fontWeight: 'bold', color: colors.semantic.success, marginTop: spacing.md },
    successDesc: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
});

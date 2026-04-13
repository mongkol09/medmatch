import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
    ChevronLeft, Upload, CheckCircle, Clock, AlertCircle, Camera, Image as ImageIcon
} from 'lucide-react-native';
import { Button } from '../../src/components/common/Button';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api, uploadFile, resolveImageUrl } from '../../src/services/api';

type VerificationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: any; desc: string }> = {
    NOT_SUBMITTED: {
        label: 'Not Submitted',
        color: colors.text.disabled,
        icon: AlertCircle,
        desc: 'Upload your professional license to get a verified badge on your profile.',
    },
    PENDING: {
        label: 'Under Review',
        color: colors.semantic.warning,
        icon: Clock,
        desc: 'Your license has been submitted and is being reviewed by our team. This usually takes 1–2 business days.',
    },
    APPROVED: {
        label: 'Verified',
        color: colors.semantic.success,
        icon: CheckCircle,
        desc: 'Your professional license has been verified. Your profile now shows a verified badge.',
    },
    REJECTED: {
        label: 'Rejected',
        color: colors.semantic.error,
        icon: AlertCircle,
        desc: 'Your verification was rejected. Please upload a clearer image of your license and try again.',
    },
};

const DOCUMENT_TYPES = [
    { value: 'DENTAL_LICENSE', label: 'ใบอนุญาตประกอบวิชาชีพทันตกรรม' },
    { value: 'MEDICAL_LICENSE', label: 'ใบอนุญาตประกอบวิชาชีพเวชกรรม' },
    { value: 'PHARMACY_LICENSE', label: 'ใบอนุญาตประกอบวิชาชีพเภสัชกรรม' },
    { value: 'NURSING_LICENSE', label: 'ใบอนุญาตประกอบวิชาชีพการพยาบาล' },
    { value: 'OTHER', label: 'เอกสารอื่นๆ' },
];

export default function VerificationScreen() {
    const router = useRouter();
    const [status, setStatus] = useState<VerificationStatus>('NOT_SUBMITTED');
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [licenseImage, setLicenseImage] = useState<string | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
    const [selectedDocType, setSelectedDocType] = useState('DENTAL_LICENSE');
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await api.get('/profile/seeker/verification-status');
            setStatus(res.data.status as VerificationStatus);
            if (res.data.license_image_url) setExistingImageUrl(resolveImageUrl(res.data.license_image_url) ?? null);
            if (res.data.rejection_reason) setRejectionReason(res.data.rejection_reason);
        } catch {
            setStatus('NOT_SUBMITTED');
        } finally {
            setIsLoading(false);
        }
    };

    const pickFromGallery = async () => {
        const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm !== 'granted') { Alert.alert('Permission required', 'Please allow photo library access.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9, allowsEditing: true,
        });
        if (!result.canceled) setLicenseImage(result.assets[0].uri);
    };

    const takePhoto = async () => {
        const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
        if (perm !== 'granted') { Alert.alert('Permission required', 'Please allow camera access.'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true });
        if (!result.canceled) setLicenseImage(result.assets[0].uri);
    };

    const handleSubmit = async () => {
        if (!licenseImage) { Alert.alert('Required', 'Please select a photo of your license.'); return; }
        setIsUploading(true);
        try {
            await uploadFile(
                '/profile/seeker/verify',
                licenseImage,
                'license',
                'license.jpg',
                'image/jpeg',
                { document_type: selectedDocType },
            );

            Alert.alert('Submitted!', 'Your license has been submitted for review. We will notify you within 1–2 business days.', [
                { text: 'OK', onPress: () => { setStatus('PENDING'); setLicenseImage(null); } },
            ]);
        } catch (err: any) {
            Alert.alert('Upload Failed', err.response?.data?.message || 'Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary.DEFAULT} /></View>;
    }

    const conf = STATUS_CONFIG[status];
    const StatusIcon = conf.icon;
    const canResubmit = status === 'NOT_SUBMITTED' || status === 'REJECTED';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>License Verification</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Status Banner */}
                <View style={[styles.statusBanner, { backgroundColor: conf.color + '15', borderColor: conf.color + '40' }]}>
                    <StatusIcon size={28} color={conf.color} />
                    <View style={styles.statusInfo}>
                        <Text style={[styles.statusLabel, { color: conf.color }]}>{conf.label}</Text>
                        <Text style={styles.statusDesc}>{conf.desc}</Text>
                        {status === 'REJECTED' && rejectionReason && (
                            <Text style={[styles.rejectionReason, { color: colors.semantic.error }]}>
                                Reason: {rejectionReason}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Existing License */}
                {existingImageUrl && !licenseImage && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Submitted License</Text>
                        <Image source={{ uri: existingImageUrl }} style={styles.licensePreview} resizeMode="contain" />
                    </View>
                )}

                {/* Document Type */}
                {canResubmit && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Document Type</Text>
                        {DOCUMENT_TYPES.map((dt) => (
                            <TouchableOpacity
                                key={dt.value}
                                style={[styles.docTypeRow, selectedDocType === dt.value && styles.docTypeRowSelected]}
                                onPress={() => setSelectedDocType(dt.value)}
                            >
                                <View style={[styles.radio, selectedDocType === dt.value && styles.radioSelected]}>
                                    {selectedDocType === dt.value && <View style={styles.radioInner} />}
                                </View>
                                <Text style={styles.docTypeLabel}>{dt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Upload Area */}
                {canResubmit && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>License Photo</Text>
                        <Text style={styles.cardHint}>
                            Take a clear, well-lit photo of your professional license. All 4 corners must be visible.
                        </Text>

                        {licenseImage ? (
                            <View style={styles.previewWrapper}>
                                <Image source={{ uri: licenseImage }} style={styles.licensePreview} resizeMode="contain" />
                                <TouchableOpacity style={styles.retakeBtn} onPress={pickFromGallery}>
                                    <Text style={styles.retakeBtnText}>Choose Different Image</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.uploadArea}>
                                <Upload size={36} color={colors.border.DEFAULT} />
                                <Text style={styles.uploadTitle}>No image selected</Text>
                                <View style={styles.uploadBtns}>
                                    <TouchableOpacity style={styles.uploadBtn} onPress={takePhoto}>
                                        <Camera size={20} color={colors.primary.DEFAULT} />
                                        <Text style={styles.uploadBtnText}>Take Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.uploadBtn} onPress={pickFromGallery}>
                                        <ImageIcon size={20} color={colors.primary.DEFAULT} />
                                        <Text style={styles.uploadBtnText}>Gallery</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {licenseImage && (
                            <Button
                                title="Submit for Verification"
                                onPress={handleSubmit}
                                isLoading={isUploading}
                                style={{ marginTop: spacing.md }}
                            />
                        )}
                    </View>
                )}

                {/* Tips */}
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>Tips for a successful verification</Text>
                    {[
                        'Ensure the photo is sharp and not blurry',
                        'All text on the license must be readable',
                        'Take the photo in good lighting — avoid shadows',
                        'Make sure all 4 corners of the document are visible',
                        'Do not edit or crop the image',
                    ].map((tip, i) => (
                        <View key={i} style={styles.tipRow}>
                            <Text style={styles.tipBullet}>•</Text>
                            <Text style={styles.tipText}>{tip}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    statusBanner: {
        flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
        padding: spacing.lg, borderRadius: borderRadii.lg, borderWidth: 1,
        marginBottom: spacing.md,
    },
    statusInfo: { flex: 1 },
    statusLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: spacing.xs },
    statusDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
    rejectionReason: { fontSize: 13, marginTop: spacing.xs, fontWeight: '500' },
    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.md, ...shadows.sm,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
    cardHint: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing.md, lineHeight: 18 },
    docTypeRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light, gap: spacing.sm,
    },
    docTypeRowSelected: { opacity: 1 },
    radio: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, borderColor: colors.border.DEFAULT,
        justifyContent: 'center', alignItems: 'center',
    },
    radioSelected: { borderColor: colors.primary.DEFAULT },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary.DEFAULT },
    docTypeLabel: { fontSize: 14, color: colors.text.primary },
    licensePreview: { width: '100%', height: 200, borderRadius: borderRadii.md, backgroundColor: colors.border.light },
    previewWrapper: { alignItems: 'center' },
    retakeBtn: { marginTop: spacing.sm, padding: spacing.sm },
    retakeBtnText: { color: colors.primary.DEFAULT, fontSize: 14, fontWeight: '600' },
    uploadArea: {
        alignItems: 'center', padding: spacing.xl,
        borderWidth: 2, borderColor: colors.border.DEFAULT, borderStyle: 'dashed',
        borderRadius: borderRadii.lg,
    },
    uploadTitle: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.md, marginBottom: spacing.lg },
    uploadBtns: { flexDirection: 'row', gap: spacing.lg },
    uploadBtn: {
        alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    uploadBtnText: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600' },
    tipsCard: {
        backgroundColor: colors.border.light, borderRadius: borderRadii.lg, padding: spacing.md,
    },
    tipsTitle: { fontSize: 13, fontWeight: '700', color: colors.text.secondary, marginBottom: spacing.sm },
    tipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 4 },
    tipBullet: { fontSize: 13, color: colors.text.secondary },
    tipText: { fontSize: 13, color: colors.text.secondary, flex: 1, lineHeight: 18 },
});

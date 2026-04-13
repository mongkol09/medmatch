import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, User, Heart, FileText, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/common/Button';
import { Input } from '../../../src/components/common/Input';
import { DatePickerField } from '../../../src/components/common/DatePickerField';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, uploadFile, resolveImageUrl } from '../../../src/services/api';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function PatientProfileEditScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [avatarUri, setAvatarUri] = useState('');

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [bloodType, setBloodType] = useState('');
    const [allergies, setAllergies] = useState('');
    const [medicalNotes, setMedicalNotes] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/profile/patient/me');
            const p = res.data;
            if (p.full_name) setFullName(p.full_name);
            if (p.phone) setPhone(p.phone);
            if (p.date_of_birth) setDateOfBirth(p.date_of_birth);
            if (p.blood_type) setBloodType(p.blood_type);
            if (p.allergies) setAllergies(p.allergies);
            if (p.medical_notes) setMedicalNotes(p.medical_notes);
            if (p.profile_image_url) setAvatarUri(p.profile_image_url);
        } catch {
            // New profile — start fresh
        } finally {
            setIsLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled && result.assets[0]) {
            setAvatarUri(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!fullName.trim()) {
            Alert.alert('Required', 'Please enter your full name.');
            return;
        }
        setIsSaving(true);
        try {
            let profileImageUrl: string | undefined;

            // Upload avatar only if it is a local file URI (not a server path or existing URL)
            if (avatarUri && avatarUri.startsWith('file://')) {
                const uploadRes = await uploadFile('/profile/upload-image?folder=profiles', avatarUri, 'file', 'patient-avatar.jpg');
                profileImageUrl = uploadRes.url;
            }

            await api.put('/profile/patient', {
                full_name: fullName.trim(),
                phone: phone.trim() || undefined,
                date_of_birth: dateOfBirth.trim() || undefined,
                allergies: allergies.trim() || undefined,
                medical_notes: medicalNotes.trim() || undefined,
                profile_image_url: profileImageUrl || (avatarUri.startsWith('http') || avatarUri.startsWith('/uploads') ? avatarUri : undefined),
            });

            Alert.alert('Saved', 'Your profile has been updated.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to save profile.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Patient Profile</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Avatar */}
                <TouchableOpacity style={styles.avatarSection} onPress={pickImage}>
                    {avatarUri ? (
                        <Image source={{ uri: resolveImageUrl(avatarUri) }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <User size={40} color={colors.text.disabled} />
                        </View>
                    )}
                    <View style={styles.cameraOverlay}>
                        <Camera size={16} color={colors.text.inverse} />
                    </View>
                </TouchableOpacity>

                {/* Basic Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Basic Information</Text>

                    <Input
                        label="Full Name *"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChangeText={setFullName}
                        leftIcon={<User size={18} color={colors.text.disabled} />}
                    />

                    <Input
                        label="Phone Number"
                        placeholder="0xx-xxx-xxxx"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        leftIcon={<Phone size={18} color={colors.text.disabled} />}
                        style={{ marginTop: spacing.md }}
                    />

                    <DatePickerField
                        label="Date of Birth"
                        value={dateOfBirth}
                        onChange={setDateOfBirth}
                        placeholder="Select your date of birth"
                        maxDate={new Date().toISOString().split('T')[0]}
                    />
                </View>

                {/* Blood Type */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Blood Type</Text>
                    <View style={styles.chipGrid}>
                        {BLOOD_TYPES.map((bt) => (
                            <TouchableOpacity
                                key={bt}
                                style={[styles.chip, bloodType === bt && styles.chipSelected]}
                                onPress={() => setBloodType(bloodType === bt ? '' : bt)}
                            >
                                <Text style={[styles.chipText, bloodType === bt && styles.chipTextSelected]}>
                                    {bt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Medical Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medical Information</Text>

                    <Input
                        label="Allergies"
                        placeholder="List any known allergies (e.g. penicillin, latex)"
                        value={allergies}
                        onChangeText={setAllergies}
                        multiline
                        numberOfLines={3}
                        leftIcon={<Heart size={18} color={colors.semantic.error} />}
                    />

                    <Input
                        label="Medical Notes"
                        placeholder="Any medical conditions, current medications, etc."
                        value={medicalNotes}
                        onChangeText={setMedicalNotes}
                        multiline
                        numberOfLines={4}
                        leftIcon={<FileText size={18} color={colors.text.disabled} />}
                        style={{ marginTop: spacing.md }}
                    />
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
                <Button
                    title="Save Profile"
                    onPress={handleSave}
                    isLoading={isSaving}
                    style={{ flex: 1 }}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: spacing.md, paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    content: { padding: spacing.xl },
    avatarSection: { alignSelf: 'center', marginBottom: spacing.xl, position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    cameraOverlay: {
        position: 'absolute', bottom: 0, right: 0,
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.background.paper,
    },
    section: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
    },
    sectionTitle: {
        fontSize: 14, fontWeight: '700', color: colors.text.secondary,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadii.full, borderWidth: 1.5,
        borderColor: colors.border.DEFAULT, backgroundColor: colors.background.paper,
    },
    chipSelected: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
    chipTextSelected: { color: colors.text.inverse },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.background.paper,
        paddingHorizontal: spacing.xl, paddingTop: spacing.md,
        borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, ...shadows.lg,
    },
});

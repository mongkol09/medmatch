import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, MapPin, Plus, X } from 'lucide-react-native';
import { Button } from '../../../src/components/common/Button';
import { Input } from '../../../src/components/common/Input';
import { colors, spacing, borderRadii, shadows } from '../../../src/theme';
import { api, uploadFile, resolveImageUrl } from '../../../src/services/api';

const FACILITIES = ['X-Ray', 'Panoramic X-Ray', 'Microscope', 'Laser', 'Parking', 'Wi-Fi', 'EV Charger', 'Café'];

export default function ClinicProfileEditScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [form, setForm] = useState({
        clinic_name: '',
        license_number: '',
        address: '',
        phone: '',
        description: '',
        chair_count: '',
        consultation_fee: '',
        bank_name: '',
        bank_account: '',
        line_oa: '',
        facilities: [] as string[],
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/profile/clinic/me');
            const p = res.data;
            setForm({
                clinic_name: p.clinic_name || '',
                license_number: p.license_number || '',
                address: p.address || '',
                phone: p.phone || '',
                description: p.description || '',
                chair_count: String(p.chair_count ?? ''),
                consultation_fee: String(p.consultation_fee ?? ''),
                bank_name: p.bank_name || '',
                bank_account: p.bank_account || '',
                line_oa: p.line_oa || '',
                facilities: p.facilities || [],
            });
            if (p.images?.length) setImages(p.images);
        } catch {
            // New profile
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddImage = async () => {
        if (images.length >= 5) { Alert.alert('Max 5 images'); return; }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8, allowsEditing: true, aspect: [16, 9],
        });
        if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri]);
    };

    const toggleFacility = (f: string) => {
        setForm((prev) => ({
            ...prev,
            facilities: prev.facilities.includes(f)
                ? prev.facilities.filter((x) => x !== f)
                : [...prev.facilities, f],
        }));
    };

    const handleSave = async () => {
        if (!form.clinic_name.trim()) { Alert.alert('Required', 'Enter your clinic name.'); return; }
        if (!form.address.trim()) { Alert.alert('Required', 'Enter your clinic address.'); return; }
        setIsSaving(true);
        try {
            // Upload new images
            const uploadedUrls: string[] = [];
            for (const img of images) {
                if (img.startsWith('http') || img.startsWith('/uploads')) {
                    // Already uploaded (absolute URL or relative server path) — keep as-is
                    uploadedUrls.push(img);
                } else {
                    const r = await uploadFile('/profile/upload-image?folder=profiles', img, 'file', 'clinic.jpg');
                    uploadedUrls.push(r.url);
                }
            }

            await api.put('/profile/clinic', {
                ...form,
                chair_count: form.chair_count ? Number(form.chair_count) : undefined,
                consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : undefined,
                images: uploadedUrls,
            });

            Alert.alert('Saved!', 'Clinic profile updated.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to save.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary.DEFAULT} /></View>;
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Clinic Profile</Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Photos */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinic Photos (max 5)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                        {images.map((uri, i) => (
                            <View key={i} style={styles.photoThumb}>
                                <Image source={{ uri: resolveImageUrl(uri) || uri }} style={styles.photoImg} />
                                <TouchableOpacity
                                    style={styles.photoRemove}
                                    onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                >
                                    <X size={12} color={colors.text.inverse} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 5 && (
                            <TouchableOpacity style={styles.photoAdd} onPress={handleAddImage}>
                                <Plus size={24} color={colors.border.DEFAULT} />
                                <Text style={styles.photoAddText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>

                {/* Basic */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinic Information</Text>
                    <Input label="Clinic Name *" placeholder="Smile Dental Care" value={form.clinic_name}
                        onChangeText={(v) => setForm((f) => ({ ...f, clinic_name: v }))} />
                    <Input label="License Number" placeholder="คร.00000" value={form.license_number}
                        onChangeText={(v) => setForm((f) => ({ ...f, license_number: v }))} />
                    <Input label="Phone" placeholder="02-XXX-XXXX" keyboardType="phone-pad" value={form.phone}
                        onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} />
                    <Input label="LINE Official Account" placeholder="@clinicname" value={form.line_oa}
                        onChangeText={(v) => setForm((f) => ({ ...f, line_oa: v }))} />
                </View>

                {/* Location */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <Input
                        label="Address *"
                        placeholder="Full address..."
                        value={form.address}
                        onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                        multiline numberOfLines={2}
                    />
                    <TouchableOpacity style={styles.mapPinBtn}
                        onPress={() => Alert.alert('Coming soon', 'Map pin feature will be available soon.')}>
                        <MapPin size={16} color={colors.primary.DEFAULT} />
                        <Text style={styles.mapPinText}>Pin on Map</Text>
                    </TouchableOpacity>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About the Clinic</Text>
                    <Input
                        label="Description"
                        placeholder="Tell patients about your clinic, services, and team..."
                        value={form.description}
                        onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                        multiline numberOfLines={4}
                    />
                    <Input label="Number of Dental Chairs" placeholder="e.g. 4" keyboardType="numeric"
                        value={form.chair_count} onChangeText={(v) => setForm((f) => ({ ...f, chair_count: v }))} />
                    <Input label="Consultation Fee (฿)" placeholder="e.g. 500" keyboardType="numeric"
                        value={form.consultation_fee}
                        onChangeText={(v) => setForm((f) => ({ ...f, consultation_fee: v }))} />
                </View>

                {/* Facilities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Facilities & Equipment</Text>
                    <View style={styles.facilityWrap}>
                        {FACILITIES.map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.facilityTag, form.facilities.includes(f) && styles.facilityTagSelected]}
                                onPress={() => toggleFacility(f)}
                            >
                                <Text style={[styles.facilityText, form.facilities.includes(f) && styles.facilityTextSelected]}>
                                    {f}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Payment */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bank Account (for receiving payment)</Text>
                    <Input label="Bank Name" placeholder="Kasikorn / SCB / Krungthai..." value={form.bank_name}
                        onChangeText={(v) => setForm((f) => ({ ...f, bank_name: v }))} />
                    <Input label="Account Number" placeholder="XXX-X-XXXXX-X" keyboardType="numeric"
                        value={form.bank_account}
                        onChangeText={(v) => setForm((f) => ({ ...f, bank_account: v }))} />
                </View>

                <Button title="Save Clinic Profile" onPress={handleSave} isLoading={isSaving} style={styles.saveBtn} />
                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    content: { padding: spacing.md },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    sectionTitle: {
        fontSize: 12, fontWeight: '700', color: colors.text.disabled,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md,
    },
    photoRow: { flexDirection: 'row' },
    photoThumb: { position: 'relative', marginRight: spacing.sm },
    photoImg: { width: 100, height: 72, borderRadius: borderRadii.md },
    photoRemove: {
        position: 'absolute', top: 4, right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
        width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    },
    photoAdd: {
        width: 100, height: 72, borderRadius: borderRadii.md,
        borderWidth: 2, borderColor: colors.border.DEFAULT, borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center',
    },
    photoAddText: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
    mapPinBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.primary.transparent, borderRadius: borderRadii.md,
        padding: spacing.md, marginTop: spacing.sm,
    },
    mapPinText: { color: colors.primary.DEFAULT, fontWeight: '600', fontSize: 14 },
    facilityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    facilityTag: {
        borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: borderRadii.full,
        paddingHorizontal: spacing.md, paddingVertical: 6,
    },
    facilityTagSelected: { borderColor: colors.secondary.DEFAULT, backgroundColor: 'rgba(16,185,129,0.1)' },
    facilityText: { fontSize: 13, color: colors.text.secondary },
    facilityTextSelected: { color: colors.secondary.DEFAULT, fontWeight: '600' },
    saveBtn: { marginTop: spacing.sm },
});

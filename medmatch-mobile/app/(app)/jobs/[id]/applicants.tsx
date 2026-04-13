import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, User, CheckCircle, XCircle, Star, Briefcase, MessageCircle } from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../../../src/theme';
import { api, resolveImageUrl } from '../../../../src/services/api';

interface Applicant {
    id: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    created_at: string;
    seeker: {
        id: string;
        first_name: string;
        last_name: string;
        license_type: string;
        license_verified?: boolean;
        experience_years?: number;
        specialties?: string[];
        rating_avg?: number;
        rating_count?: number;
        profile_image_url?: string;
    };
}

const SPECIALTY_LABELS: Record<string, string> = {
    DENTIST: 'ทันตแพทย์',
    DOCTOR: 'แพทย์ทั่วไป',
    PHARMACIST: 'เภสัชกร',
    NURSE: 'พยาบาล',
    DENTAL_ASSISTANT: 'ผู้ช่วยทันตแพทย์',
    PHYSIOTHERAPIST: 'นักกายภาพบำบัด',
    OTHER: 'อื่นๆ',
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    PENDING:  { bg: '#FEF3C7', text: '#D97706', label: 'Pending' },
    ACCEPTED: { bg: '#D1FAE5', text: '#059669', label: 'Accepted' },
    REJECTED: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
};

export default function ApplicantsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [jobTitle, setJobTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchApplicants = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [jobRes, appsRes] = await Promise.all([
                api.get(`/jobs/${id}`),
                api.get(`/jobs/${id}/applicants`),
            ]);
            setJobTitle(jobRes.data.title);
            setApplicants(appsRes.data);
        } catch {
            Alert.alert('Error', 'Could not load applicants.', [
                { text: 'Go Back', onPress: () => router.back() },
            ]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchApplicants(); }, []);

    const handleAction = async (applicantId: string, action: 'accept' | 'reject') => {
        setProcessingId(applicantId);
        try {
            if (action === 'accept') {
                await api.post(`/jobs/applicants/${applicantId}/accept`);
            } else {
                await api.post(`/jobs/applicants/${applicantId}/reject`);
            }
            setApplicants((prev) =>
                prev.map((a) =>
                    a.id === applicantId
                        ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' }
                        : a
                )
            );
        } catch (err: any) {
            Alert.alert('Failed', err.response?.data?.message || 'Action failed.');
        } finally {
            setProcessingId(null);
        }
    };

    const openChat = async (seekerId: string) => {
        try {
            const res = await api.post('/chat/conversations', { participant_id: seekerId });
            router.push(`/(app)/chat/${res.data.id}` as any);
        } catch {
            Alert.alert('Error', 'Could not open chat.');
        }
    };

    const renderItem = ({ item }: { item: Applicant }) => {
        const s = item.seeker;
        const statusStyle = STATUS_STYLE[item.status];
        const isProcessing = processingId === item.id;

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    {s.profile_image_url ? (
                        <Image source={{ uri: resolveImageUrl(s.profile_image_url) }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <User size={22} color={colors.text.disabled} />
                        </View>
                    )}

                    <View style={styles.info}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>{`${s.first_name} ${s.last_name}`}</Text>
                            {s.license_verified && (
                                <CheckCircle size={14} color={colors.secondary.DEFAULT} fill={colors.secondary.DEFAULT} />
                            )}
                        </View>
                        <Text style={styles.specialty}>{SPECIALTY_LABELS[s.license_type] || s.license_type}</Text>
                        <View style={styles.metaRow}>
                            {s.experience_years != null && (
                                <View style={styles.metaItem}>
                                    <Briefcase size={12} color={colors.text.disabled} />
                                    <Text style={styles.metaText}>{s.experience_years}yr</Text>
                                </View>
                            )}
                            {s.rating_avg != null && (
                                <View style={styles.metaItem}>
                                    <Star size={12} fill={colors.semantic.warning} color={colors.semantic.warning} />
                                    <Text style={styles.metaText}>{s.rating_avg.toFixed(1)}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.viewProfileBtn}
                    onPress={() => router.push(`/(app)/seeker-profile/${item.seeker.id}` as any)}
                >
                    <User size={14} color={colors.primary.DEFAULT} />
                    <Text style={styles.viewProfileText}>View Full Profile</Text>
                </TouchableOpacity>

                {item.status === 'PENDING' && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            disabled={isProcessing}
                            onPress={() => handleAction(item.id, 'reject')}
                        >
                            <XCircle size={16} color={colors.semantic.error} />
                            <Text style={[styles.actionText, { color: colors.semantic.error }]}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            disabled={isProcessing}
                            onPress={() => handleAction(item.id, 'accept')}
                        >
                            {isProcessing ? (
                                <ActivityIndicator size="small" color={colors.text.inverse} />
                            ) : (
                                <>
                                    <CheckCircle size={16} color={colors.text.inverse} />
                                    <Text style={[styles.actionText, { color: colors.text.inverse }]}>Accept</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {item.status === 'ACCEPTED' && (
                    <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => openChat(s.id)}
                    >
                        <MessageCircle size={16} color={colors.primary.DEFAULT} />
                        <Text style={styles.chatBtnText}>Open Chat</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const pending = applicants.filter((a) => a.status === 'PENDING');
    const accepted = applicants.filter((a) => a.status === 'ACCEPTED');
    const rejected = applicants.filter((a) => a.status === 'REJECTED');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Applicants</Text>
                    {jobTitle ? <Text style={styles.headerSub} numberOfLines={1}>{jobTitle}</Text> : null}
                </View>
                <View style={{ width: 26 }} />
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <>
                    {/* Stats Bar */}
                    <View style={styles.statsBar}>
                        <StatPill label="Pending" count={pending.length} color={colors.semantic.warning} />
                        <StatPill label="Accepted" count={accepted.length} color={colors.semantic.success} />
                        <StatPill label="Rejected" count={rejected.length} color={colors.semantic.error} />
                    </View>

                    <FlatList
                        data={applicants}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={() => { setIsRefreshing(true); fetchApplicants(true); }}
                                tintColor={colors.primary.DEFAULT}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <User size={40} color={colors.border.DEFAULT} />
                                <Text style={styles.emptyTitle}>No applicants yet</Text>
                                <Text style={styles.emptyDesc}>Applicants will appear here when providers apply to this job.</Text>
                            </View>
                        }
                    />
                </>
            )}
        </View>
    );
}

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <View style={[styles.statPill, { backgroundColor: color + '18' }]}>
            <Text style={[styles.statCount, { color }]}>{count}</Text>
            <Text style={[styles.statLabel, { color }]}>{label}</Text>
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
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text.primary },
    headerSub: { fontSize: 12, color: colors.text.secondary, maxWidth: 200 },
    statsBar: {
        flexDirection: 'row', padding: spacing.md, gap: spacing.sm,
        backgroundColor: colors.background.paper, borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    statPill: { flex: 1, borderRadius: borderRadii.md, padding: spacing.sm, alignItems: 'center' },
    statCount: { fontSize: 20, fontWeight: 'bold' },
    statLabel: { fontSize: 11, fontWeight: '600' },
    listContent: { padding: spacing.md, paddingBottom: 40 },
    card: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.lg,
        padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    avatarPlaceholder: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    info: { flex: 1, marginLeft: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    name: { fontSize: 16, fontWeight: '600', color: colors.text.primary, flex: 1 },
    specialty: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', gap: spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 12, color: colors.text.disabled },
    statusBadge: { borderRadius: borderRadii.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.light },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadii.md, borderWidth: 1.5,
    },
    rejectBtn: { borderColor: colors.semantic.error, backgroundColor: '#FEF2F2' },
    acceptBtn: { borderColor: 'transparent', backgroundColor: colors.primary.DEFAULT },
    actionText: { fontSize: 14, fontWeight: '600' },
    chatBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.light,
        paddingVertical: spacing.sm,
    },
    chatBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary.DEFAULT },
    emptyState: { alignItems: 'center', padding: spacing.xl, marginTop: 60 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    emptyDesc: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
    viewProfileBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, paddingVertical: spacing.sm, marginTop: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    viewProfileText: { fontSize: 13, fontWeight: '600', color: colors.primary.DEFAULT },
});

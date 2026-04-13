import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    ChevronLeft, Bell, Briefcase, MessageCircle,
    Calendar, DollarSign, CheckCircle, AlertCircle
} from 'lucide-react-native';
import { colors, spacing, borderRadii, shadows } from '../../src/theme';
import { api } from '../../src/services/api';

type NotifType =
    | 'JOB_MATCH'
    | 'JOB_ACCEPTED'
    | 'JOB_REJECTED'
    | 'NEW_MESSAGE'
    | 'BOOKING_CONFIRMED'
    | 'BOOKING_CANCELLED'
    | 'PAYMENT_VERIFIED'
    | 'NEW_REVIEW'
    | 'SYSTEM';

interface Notification {
    id: string;
    type: NotifType;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
    meta?: {
        job_id?: string;
        booking_id?: string;
        conversation_id?: string;
    };
}

const TYPE_ICON: Record<NotifType, { icon: any; color: string }> = {
    JOB_MATCH:          { icon: Briefcase,    color: colors.primary.DEFAULT },
    JOB_ACCEPTED:       { icon: CheckCircle,  color: colors.secondary.DEFAULT },
    JOB_REJECTED:       { icon: AlertCircle,  color: colors.semantic.error },
    NEW_MESSAGE:        { icon: MessageCircle,color: colors.primary.light },
    BOOKING_CONFIRMED:  { icon: Calendar,     color: colors.secondary.DEFAULT },
    BOOKING_CANCELLED:  { icon: Calendar,     color: colors.semantic.error },
    PAYMENT_VERIFIED:   { icon: DollarSign,   color: colors.secondary.DEFAULT },
    NEW_REVIEW:         { icon: CheckCircle,  color: colors.semantic.warning },
    SYSTEM:             { icon: Bell,         color: colors.text.disabled },
};

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PAGE_SIZE = 20;

export default function NotificationsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);

    const fetchNotifications = useCallback(async (silent = false, resetPage = true) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/notifications', {
                params: { page: 1, limit: PAGE_SIZE },
            });
            const { data, hasMore: more } = res.data;
            setNotifications(data);
            setHasMore(more);
            setPage(1);
        } catch {
            // Keep existing
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, []);

    const loadMore = async () => {
        if (!hasMore || isLoadingMore) return;
        setIsLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);
        try {
            const res = await api.get('/notifications', {
                params: { page: nextPage, limit: PAGE_SIZE },
            });
            const { data, hasMore: more } = res.data;
            setNotifications((prev) => [...prev, ...data]);
            setHasMore(more);
        } catch {}
        finally {
            setIsLoadingMore(false);
        }
    };

    const markAllRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch {}
    };

    const handlePress = async (notif: Notification) => {
        // Mark as read
        if (!notif.is_read) {
            api.patch(`/notifications/${notif.id}/read`).catch(() => {});
            setNotifications((prev) =>
                prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n)
            );
        }

        // Navigate based on type
        const m = notif.meta;
        if (notif.type === 'NEW_MESSAGE' && m?.conversation_id) {
            router.push(`/(app)/chat/${m.conversation_id}` as any);
        } else if ((notif.type === 'JOB_MATCH' || notif.type === 'JOB_ACCEPTED' || notif.type === 'JOB_REJECTED') && m?.job_id) {
            router.push(`/(app)/jobs/${m.job_id}/applicants` as any);
        } else if ((notif.type === 'BOOKING_CONFIRMED' || notif.type === 'PAYMENT_VERIFIED' || notif.type === 'BOOKING_CANCELLED') && m?.booking_id) {
            router.push(`/(app)/payment/${m.booking_id}` as any);
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const renderItem = ({ item }: { item: Notification }) => {
        const typeConf = TYPE_ICON[item.type] || TYPE_ICON.SYSTEM;
        const IconComp = typeConf.icon;

        return (
            <TouchableOpacity
                style={[styles.notifItem, !item.is_read && styles.notifUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconCircle, { backgroundColor: typeConf.color + '18' }]}>
                    <IconComp size={20} color={typeConf.color} />
                </View>
                <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>
                        {item.title}
                    </Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                    <Text style={styles.notifTime}>{formatTime(item.created_at)}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={26} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 ? (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 80 }} />
                )}
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.3}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchNotifications(true, true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    ListFooterComponent={
                        isLoadingMore ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Bell size={48} color={colors.border.DEFAULT} />
                            <Text style={styles.emptyTitle}>No notifications yet</Text>
                            <Text style={styles.emptyDesc}>
                                You'll be notified about job matches, bookings, messages, and more.
                            </Text>
                        </View>
                    }
                />
            )}
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
    markAllText: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600' },
    notifItem: {
        flexDirection: 'row', alignItems: 'flex-start',
        padding: spacing.md, paddingHorizontal: spacing.lg,
        backgroundColor: colors.background.paper,
    },
    notifUnread: { backgroundColor: colors.primary.transparent + '30' },
    iconCircle: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
    },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 15, fontWeight: '500', color: colors.text.primary, marginBottom: 2 },
    notifTitleUnread: { fontWeight: '700' },
    notifBody: { fontSize: 13, color: colors.text.secondary, lineHeight: 18, marginBottom: 4 },
    notifTime: { fontSize: 11, color: colors.text.disabled },
    unreadDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: colors.primary.DEFAULT, marginLeft: spacing.sm, marginTop: 6,
    },
    separator: { height: 1, backgroundColor: colors.border.light, marginLeft: 76 },
    emptyContainer: { flex: 1 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, marginTop: 100 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    emptyDesc: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
    footerLoader: { paddingVertical: spacing.lg, alignItems: 'center' },
});

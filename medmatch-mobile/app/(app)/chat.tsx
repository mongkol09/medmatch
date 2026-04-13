import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, MessageCircle } from 'lucide-react-native';
import { colors, spacing } from '../../src/theme';
import { api, resolveImageUrl } from '../../src/services/api';

interface Conversation {
    id: string;
    type: 'match' | 'booking';
    participant_name: string;
    participant_avatar?: string;
    last_message?: string;
    last_message_at?: string;
    unread_count: number;
}

function formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function ChatListScreen() {
    const router = useRouter();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchConversations = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await api.get('/chat/conversations');
            setConversations(res.data);
        } catch {
            // Keep empty state on error
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
    }, []);

    const renderItem = ({ item }: { item: Conversation }) => (
        <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push({ pathname: '/(app)/chat/[id]', params: { id: item.id, name: item.participant_name, type: item.type } } as any)}
            activeOpacity={0.7}
        >
            <View style={styles.avatarWrapper}>
                {item.participant_avatar ? (
                    <Image source={{ uri: resolveImageUrl(item.participant_avatar) }} style={styles.avatarImage} />
                ) : (
                    <View style={styles.avatarFallback}>
                        <User size={22} color={colors.text.disabled} />
                    </View>
                )}
                {item.unread_count > 0 && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text
                        style={[styles.name, item.unread_count > 0 && styles.nameUnread]}
                        numberOfLines={1}
                    >
                        {item.participant_name}
                    </Text>
                    <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
                </View>
                <View style={styles.messageRow}>
                    <Text
                        style={[styles.lastMessage, item.unread_count > 0 && styles.lastMessageUnread]}
                        numberOfLines={1}
                    >
                        {item.last_message || 'No messages yet'}
                    </Text>
                    {item.unread_count > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {item.unread_count > 99 ? '99+' : item.unread_count}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchConversations(true); }}
                            tintColor={colors.primary.DEFAULT}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MessageCircle size={48} color={colors.border.DEFAULT} />
                            <Text style={styles.emptyTitle}>No conversations yet</Text>
                            <Text style={styles.emptyDesc}>
                                Conversations will appear here after you match with a clinic or patient.
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
    header: {
        paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text.primary },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, marginTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
    emptyDesc: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },

    chatItem: {
        flexDirection: 'row', padding: spacing.md,
        paddingHorizontal: spacing.xl, backgroundColor: colors.background.paper,
    },
    avatarWrapper: { position: 'relative', marginRight: spacing.md },
    avatarImage: { width: 52, height: 52, borderRadius: 26 },
    avatarFallback: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: colors.border.light, justifyContent: 'center', alignItems: 'center',
    },
    onlineDot: {
        position: 'absolute', bottom: 2, right: 2,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: colors.semantic.success,
        borderWidth: 2, borderColor: colors.background.paper,
    },
    chatInfo: { flex: 1, justifyContent: 'center' },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    name: { fontSize: 16, fontWeight: '500', color: colors.text.primary, flex: 1 },
    nameUnread: { fontWeight: '700' },
    time: { fontSize: 12, color: colors.text.secondary },
    messageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lastMessage: { flex: 1, fontSize: 14, color: colors.text.secondary, paddingRight: spacing.sm },
    lastMessageUnread: { color: colors.text.primary, fontWeight: '500' },
    badge: {
        backgroundColor: colors.primary.DEFAULT, paddingHorizontal: 6,
        paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center',
    },
    badgeText: { color: colors.text.inverse, fontSize: 10, fontWeight: 'bold' },
    separator: { height: 1, backgroundColor: colors.border.light, marginLeft: 84 },
});

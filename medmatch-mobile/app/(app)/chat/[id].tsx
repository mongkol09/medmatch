import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send, ChevronLeft } from 'lucide-react-native';
import { colors, spacing, borderRadii } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';
import { chatSocket } from '../../../src/store/chatSocket';
import { api } from '../../../src/services/api';

interface Message {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    readAt?: string | null;
}

type ListItem = Message | { _isSeparator: true; date: string; id: string };

function formatSeparatorDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildListItems(messages: Message[]): ListItem[] {
    const items: ListItem[] = [];
    let lastDateKey = '';
    for (const msg of messages) {
        const dateKey = new Date(msg.createdAt).toDateString();
        if (dateKey !== lastDateKey) {
            items.push({ _isSeparator: true, date: msg.createdAt, id: `sep_${dateKey}` });
            lastDateKey = dateKey;
        }
        items.push(msg);
    }
    return items;
}

export default function ChatRoomScreen() {
    const { id, type: conversationType, name } = useLocalSearchParams<{ id: string; type?: string; name?: string }>();
    const router = useRouter();
    const { user } = useAuthStore();
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [participantName, setParticipantName] = useState(name || '');
    const [isTyping, setIsTyping] = useState(false);

    const convType = (conversationType as 'match' | 'booking') || 'match';

    useEffect(() => {
        if (!participantName) {
            api.get('/chat/conversations').then((res) => {
                const conv = (res.data || []).find((c: any) => c.id === id);
                if (conv?.participant_name) setParticipantName(conv.participant_name);
            }).catch(() => {});
        }
    }, [id]);

    const loadMessages = async () => {
        try {
            const res = await api.get(`/chat/${id}/messages?type=${convType}&limit=50`);
            // Normalize: REST returns snake_case, socket sends camelCase
            const normalized: Message[] = (res.data || []).reverse().map((m: any) => ({
                id: m.id,
                senderId: m.sender_id,
                content: m.content,
                createdAt: m.created_at,
                readAt: m.read_at,
            }));
            setMessages(normalized);
        } catch (e) {
            console.log('Could not load message history', e);
        }
    };

    useEffect(() => {
        chatSocket.connect();
        loadMessages();

        api.patch(`/chat/${id}/read?type=${convType}`).catch(() => {});

        chatSocket.joinConversation(id, convType, (msg: any) => {
            // Skip if this is our own message echoed back (we already added it optimistically)
            if (msg.senderId === user?.id) return;

            setMessages((prev) => [...prev, {
                id: msg.id || `remote_${Math.random()}`,
                senderId: msg.senderId,
                content: msg.content,
                createdAt: msg.createdAt || new Date().toISOString(),
                readAt: null,
            }]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        chatSocket.onTyping(() => {
            setIsTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        });

        return () => {
            chatSocket.leaveConversation(id, convType);
            chatSocket.offTyping();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [id]);

    const handleTextChange = (text: string) => {
        setInputText(text);
        if (text.length > 0) {
            chatSocket.sendTyping(id, convType);
        }
    };

    const handleSend = () => {
        if (!inputText.trim() || !user) return;

        chatSocket.sendMessage(id, convType, inputText.trim());

        setMessages((prev) => [...prev, {
            id: `local_${Date.now()}`,
            senderId: user.id,
            content: inputText.trim(),
            createdAt: new Date().toISOString(),
            readAt: null,
        }]);

        setInputText('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const listItems = useMemo(() => buildListItems(messages), [messages]);

    const renderItem = ({ item }: { item: ListItem }) => {
        if ('_isSeparator' in item) {
            return (
                <View style={styles.separatorRow}>
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>{formatSeparatorDate(item.date)}</Text>
                    <View style={styles.separatorLine} />
                </View>
            );
        }

        const isMe = item.senderId === user?.id;
        return (
            <View style={[styles.messageBubbleContainer, isMe ? styles.messageMe : styles.messageThem]}>
                <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.messageText, isMe ? styles.textMe : styles.textThem]}>
                        {item.content}
                    </Text>
                </View>
                <View style={styles.messageFooter}>
                    <Text style={styles.messageTime}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMe && (
                        <Text style={[styles.readTick, !!item.readAt && styles.readTickRead]}>
                            {item.readAt ? '✓✓' : '✓'}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.container}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={28} color={colors.text.primary} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{participantName || 'Chat'}</Text>
                        {isTyping && <Text style={styles.typingSubtitle}>typing...</Text>}
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                {/* Message List */}
                <FlatList
                    ref={flatListRef}
                    data={listItems}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    ListFooterComponent={
                        isTyping ? (
                            <View style={styles.typingBubbleRow}>
                                <View style={styles.typingBubble}>
                                    <Text style={styles.typingDots}>● ● ●</Text>
                                </View>
                            </View>
                        ) : null
                    }
                />

                {/* Input Area */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.text.disabled}
                        value={inputText}
                        onChangeText={handleTextChange}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Send size={20} color={colors.text.inverse} style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background.paper },
    container: { flex: 1, backgroundColor: colors.background.DEFAULT },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.md,
        backgroundColor: colors.background.paper,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    backButton: { padding: spacing.xs },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
    typingSubtitle: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
    messageList: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },

    // Date separator
    separatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.md,
        gap: spacing.sm,
    },
    separatorLine: { flex: 1, height: 1, backgroundColor: colors.border.light },
    separatorText: { fontSize: 12, color: colors.text.disabled, paddingHorizontal: spacing.xs },

    // Message bubbles
    messageBubbleContainer: { maxWidth: '80%', marginBottom: spacing.xs },
    messageMe: { alignSelf: 'flex-end' },
    messageThem: { alignSelf: 'flex-start' },
    messageBubble: { padding: spacing.md, borderRadius: borderRadii.lg },
    bubbleMe: {
        backgroundColor: colors.primary.DEFAULT,
        borderBottomRightRadius: 0,
    },
    bubbleThem: {
        backgroundColor: colors.background.paper,
        borderBottomLeftRadius: 0,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    messageText: { fontSize: 16, lineHeight: 22 },
    textMe: { color: colors.text.inverse },
    textThem: { color: colors.text.primary },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
        marginTop: 3,
        paddingHorizontal: 4,
    },
    messageTime: { fontSize: 11, color: colors.text.disabled },
    readTick: { fontSize: 11, color: colors.text.disabled },
    readTickRead: { color: colors.primary.DEFAULT },

    // Typing indicator
    typingBubbleRow: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    typingBubble: {
        backgroundColor: colors.background.paper,
        borderRadius: borderRadii.lg,
        borderBottomLeftRadius: 0,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    typingDots: { fontSize: 10, color: colors.text.disabled, letterSpacing: 3 },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.background.paper,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        backgroundColor: colors.background.DEFAULT,
        borderRadius: borderRadii.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 16,
        color: colors.text.primary,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
        marginBottom: 2,
    },
    sendButtonDisabled: { backgroundColor: colors.border.DEFAULT },
});

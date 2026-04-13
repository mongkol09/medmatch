import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './authStore';
import { Platform } from 'react-native';

// Reads from .env (EXPO_PUBLIC_API_URL) — same source as api.ts
const getSocketOrigin = (): string => {
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
};

class ChatSocketService {
    private socket: Socket | null = null;
    // Single active room listener (only one chat room open at a time)
    private messageListener: ((msg: any) => void) | null = null;
    private typingListener: ((data: { userId: string }) => void) | null = null;

    connect() {
        if (this.socket?.connected) return;

        const { accessToken } = useAuthStore.getState();
        if (!accessToken) return;

        // Backend uses @WebSocketGateway({ namespace: '/chat' })
        this.socket = io(`${getSocketOrigin()}/chat`, {
            auth: { token: accessToken },
            transports: ['websocket'],
        });

        this.socket.on('connect', () => {
            console.log('Chat Socket Connected:', this.socket?.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Chat Socket Disconnected');
        });

        this.socket.on('new-message', (data: any) => {
            this.messageListener?.(data);
        });

        this.socket.on('user-typing', (data: any) => {
            this.typingListener?.(data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /** Join a conversation room and register a callback for incoming messages. */
    joinConversation(
        conversationId: string,
        type: 'match' | 'booking',
        onNewMessage: (msg: any) => void,
    ) {
        if (!this.socket?.connected) this.connect();
        this.messageListener = onNewMessage;
        // Backend handleJoin expects { conversationId, type }
        this.socket?.emit('join', { conversationId, type });
    }

    leaveConversation(_conversationId: string, _type: 'match' | 'booking') {
        this.messageListener = null;
        // No 'leave' event on backend — socket room membership ends on disconnect
    }

    /** Send a chat message. `type` is the conversation type (match/booking). */
    sendMessage(conversationId: string, type: 'match' | 'booking', content: string) {
        this.socket?.emit('message', { conversationId, type, content });
    }

    /** Emit a typing signal to other participants. */
    sendTyping(conversationId: string, type: 'match' | 'booking') {
        this.socket?.emit('typing', { conversationId, type });
    }

    /** Register a callback for when the other participant is typing. */
    onTyping(callback: (data: { userId: string }) => void) {
        this.typingListener = callback;
    }

    offTyping() {
        this.typingListener = null;
    }
}

export const chatSocket = new ChatSocketService();

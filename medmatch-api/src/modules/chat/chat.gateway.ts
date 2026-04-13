import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/auth.service';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(ChatGateway.name);
    private activeUsers = new Map<string, string>(); // userId -> socketId

    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
            if (!token) {
                client.disconnect();
                return;
            }
            const payload: JwtPayload = this.jwt.verify(token);
            this.activeUsers.set(payload.sub, client.id);
            client.data.userId = payload.sub;
            this.logger.log(`User connected: ${payload.sub}`);
        } catch {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        if (client.data.userId) {
            this.activeUsers.delete(client.data.userId);
            this.logger.log(`User disconnected: ${client.data.userId}`);
        }
    }

    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string; type: 'match' | 'booking' },
    ) {
        const room = `${data.type}_${data.conversationId}`;
        await client.join(room);
        this.logger.log(`User ${client.data.userId} joined room: ${room}`);
    }

    @SubscribeMessage('message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: {
            conversationId: string;
            type: 'match' | 'booking';
            content: string;
        },
    ) {
        const senderId = client.data.userId;
        const room = `${data.type}_${data.conversationId}`;

        // Save message to database
        const message = await this.prisma.message.create({
            data: {
                sender_id: senderId,
                content: data.content,
                ...(data.type === 'match' && { match_id: data.conversationId }),
                ...(data.type === 'booking' && { booking_id: data.conversationId }),
            },
        });

        // Broadcast to OTHER participants in the room (exclude sender — they already have the optimistic message)
        client.to(room).emit('new-message', {
            id: message.id,
            senderId,
            content: data.content,
            createdAt: message.created_at,
        });
    }

    @SubscribeMessage('typing')
    async handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: { conversationId: string; type: 'match' | 'booking' },
    ) {
        const room = `${data.type}_${data.conversationId}`;
        client.to(room).emit('user-typing', {
            userId: client.data.userId,
        });
    }

    @SubscribeMessage('read')
    async handleRead(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: {
            conversationId: string;
            type: 'match' | 'booking';
            messageId: string;
        },
    ) {
        await this.prisma.message.update({
            where: { id: data.messageId },
            data: { read_at: new Date() },
        });

        const room = `${data.type}_${data.conversationId}`;
        this.server.to(room).emit('message-read', {
            messageId: data.messageId,
            readBy: client.data.userId,
        });
    }
}

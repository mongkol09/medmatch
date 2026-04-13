import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
    constructor(private readonly prisma: PrismaService) { }

    @Post('conversations')
    @ApiOperation({ summary: 'Create or get a conversation with a participant' })
    async createOrGetConversation(
        @CurrentUser() user: JwtPayload,
        @Body() body: { participant_id: string },
    ) {
        // Find existing match between these two users (seeker↔clinic)
        const existing = await this.prisma.match.findFirst({
            where: {
                OR: [
                    {
                        seeker: { user_id: user.sub },
                        clinic: { user_id: body.participant_id },
                    },
                    {
                        seeker: { user_id: body.participant_id },
                        clinic: { user_id: user.sub },
                    },
                ],
            },
            select: { id: true },
        });
        if (existing) return { id: existing.id };

        // For cross-role conversations (e.g., patient↔clinic) use booking match
        const bookingConv = await this.prisma.booking.findFirst({
            where: {
                OR: [
                    {
                        patient: { user_id: user.sub },
                        clinic: { user_id: body.participant_id },
                    },
                    {
                        patient: { user_id: body.participant_id },
                        clinic: { user_id: user.sub },
                    },
                ],
            },
            select: { id: true },
        });
        if (bookingConv) return { id: bookingConv.id };

        throw new NotFoundException('No existing conversation. Conversations are created automatically when a job match or booking occurs.');
    }

    @Patch(':conversationId/read')
    @ApiOperation({ summary: 'Mark messages in conversation as read' })
    async markRead(
        @CurrentUser() user: JwtPayload,
        @Param('conversationId') conversationId: string,
        @Query('type') type: 'match' | 'booking' = 'match',
    ) {
        await this.prisma.message.updateMany({
            where: {
                ...(type === 'booking'
                    ? { booking_id: conversationId }
                    : { match_id: conversationId }),
                sender_id: { not: user.sub },
                read_at: null,
            },
            data: { read_at: new Date() },
        });
        return { ok: true };
    }

    @Get('conversations')
    @ApiOperation({ summary: 'Get all chat conversations' })
    async getConversations(@CurrentUser() user: JwtPayload) {
        const userId = user.sub;

        const matches = await this.prisma.match.findMany({
            where: {
                OR: [
                    { seeker: { user_id: userId } },
                    { clinic: { user_id: userId } },
                ],
            },
            include: {
                seeker: {
                    select: {
                        user_id: true,
                        first_name: true,
                        last_name: true,
                        profile_image_url: true,
                    },
                },
                clinic: {
                    select: {
                        user_id: true,
                        clinic_name: true,
                        images: true,
                    },
                },
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1,
                    select: { content: true, created_at: true },
                },
                _count: {
                    select: {
                        messages: {
                            where: { sender_id: { not: userId }, read_at: null },
                        },
                    },
                },
            },
            orderBy: { updated_at: 'desc' },
        });

        return matches.map((m) => {
            const iAmSeeker = m.seeker?.user_id === userId;
            const images = m.clinic?.images as string[] | null;
            const participant_name = iAmSeeker
                ? (m.clinic?.clinic_name ?? 'Clinic')
                : `${m.seeker?.first_name ?? ''} ${m.seeker?.last_name ?? ''}`.trim() || 'Seeker';
            const participant_avatar = iAmSeeker
                ? (Array.isArray(images) ? (images[0] ?? null) : null)
                : (m.seeker?.profile_image_url ?? null);

            return {
                id: m.id,
                type: 'match' as const,
                participant_name,
                participant_avatar,
                last_message: m.messages[0]?.content ?? null,
                last_message_at: m.messages[0]?.created_at ?? null,
                unread_count: m._count.messages,
            };
        });
    }

    @Get(':conversationId/messages')
    @ApiOperation({ summary: 'Get messages for a conversation' })
    async getMessages(
        @Param('conversationId') conversationId: string,
        @Query('type') type: 'match' | 'booking',
        @Query('page') page = '1',
        @Query('limit') limit = '50',
    ) {
        const skip = (parseInt(page) - 1) * parseInt(limit);

        return this.prisma.message.findMany({
            where: {
                ...(type === 'match' && { match_id: conversationId }),
                ...(type === 'booking' && { booking_id: conversationId }),
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: parseInt(limit),
            select: {
                id: true,
                sender_id: true,
                content: true,
                read_at: true,
                created_at: true,
            },
        });
    }
}

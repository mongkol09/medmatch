import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
    constructor(private readonly notifService: NotificationService) { }

    @Get()
    @ApiOperation({ summary: 'Get notifications for the current user (paginated)' })
    async getNotifications(
        @CurrentUser() user: JwtPayload,
        @Query('limit') limit = '20',
        @Query('page') page = '1',
    ) {
        return this.notifService.getForUser(user.sub, parseInt(limit), parseInt(page));
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Get unread notification count' })
    async getUnreadCount(@CurrentUser() user: JwtPayload) {
        const count = await this.notifService.getUnreadCount(user.sub);
        return { count };
    }

    @Patch('read-all')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark all notifications as read' })
    async markAllRead(@CurrentUser() user: JwtPayload) {
        return this.notifService.markAllRead(user.sub);
    }

    @Patch(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a single notification as read' })
    async markRead(@Param('id') id: string) {
        return this.notifService.markRead(id);
    }
}

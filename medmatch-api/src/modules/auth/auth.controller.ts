import {
    Controller,
    Post,
    Patch,
    Body,
    Delete,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    SwitchRoleDto,
    SendOtpDto,
    VerifyOtpCodeDto,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
    ) { }

    @Post('register')
    @ApiOperation({ summary: 'Register new user — returns userId for OTP verification' })
    async register(@Body() dto: RegisterDto, @Req() req: Request) {
        return this.authService.register(dto, req.ip);
    }

    @Post('send-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend OTP to user' })
    async sendOtp(@Body() dto: SendOtpDto) {
        await this.authService.sendOtp(dto.userId);
        return { message: 'Verification code sent' };
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify OTP code and receive auth tokens' })
    async verifyOtp(@Body() dto: VerifyOtpCodeDto) {
        return this.authService.verifyOtp(dto.userId, dto.code);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email/phone + password' })
    async login(@Body() dto: LoginDto, @Req() req: Request) {
        return this.authService.login(dto, req.ip);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token' })
    async refreshToken(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshToken(dto);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout (revoke refresh tokens)' })
    async logout(@CurrentUser() user: JwtPayload) {
        await this.authService.logout(user.sub);
        return { message: 'Logged out successfully' };
    }

    @Post('switch-role')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Switch between SEEKER and PATIENT roles' })
    async switchRole(
        @CurrentUser() user: JwtPayload,
        @Body() dto: SwitchRoleDto,
    ) {
        return this.authService.switchRole(user.sub, dto.newRole);
    }

    @Delete('account')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete account (PDPA Right to Delete)' })
    async deleteAccount(@CurrentUser() user: JwtPayload, @Req() req: Request) {
        await this.authService.deleteAccount(user.sub, req.ip);
        return { message: 'Account deleted successfully' };
    }

    @Patch('fcm-token')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Register/update FCM push token for current user' })
    async updateFcmToken(
        @CurrentUser() user: JwtPayload,
        @Body() body: { fcm_token: string },
    ) {
        if (!body.fcm_token) throw new BadRequestException('fcm_token is required');
        await this.prisma.user.update({
            where: { id: user.sub },
            data: { fcm_token: body.fcm_token },
        });
        return { message: 'FCM token updated' };
    }

    @Patch('change-password')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change password' })
    async changePassword(
        @CurrentUser() user: JwtPayload,
        @Body() body: { current_password: string; new_password: string },
    ) {
        if (!body.current_password || !body.new_password) {
            throw new BadRequestException('current_password and new_password are required');
        }
        if (body.new_password.length < 8) {
            throw new BadRequestException('New password must be at least 8 characters');
        }
        const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
        if (!dbUser) throw new NotFoundException('User not found');

        const valid = await this.encryption.verifyPassword(body.current_password, dbUser.password_hash);
        if (!valid) throw new BadRequestException('Current password is incorrect');

        const newHash = await this.encryption.hashPassword(body.new_password);
        await this.prisma.user.update({
            where: { id: user.sub },
            data: { password_hash: newHash },
        });
        return { message: 'Password changed successfully' };
    }
}

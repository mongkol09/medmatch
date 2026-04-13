import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
    Matches,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiPropertyOptional({ example: '0812345678', description: 'Thai phone number (optional if email provided)' })
    @IsOptional()
    @IsString()
    @Matches(/^0[0-9]{9}$/, { message: 'Invalid Thai phone number' })
    phone?: string;

    @ApiPropertyOptional({ example: 'user@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ minLength: 8 })
    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({ enum: UserRole, example: 'PATIENT' })
    @IsEnum(UserRole)
    role: UserRole;

    @ApiPropertyOptional({ description: 'Firebase UID from OTP verification' })
    @IsOptional()
    @IsString()
    firebaseUid?: string;
}

export class LoginDto {
    @ApiPropertyOptional({ example: '0812345678' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'user@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    password: string;
}

export class SendOtpDto {
    @ApiProperty({ description: 'User ID to send OTP to' })
    @IsNotEmpty()
    @IsString()
    userId: string;
}

export class VerifyOtpCodeDto {
    @ApiProperty({ description: 'User ID' })
    @IsNotEmpty()
    @IsString()
    userId: string;

    @ApiProperty({ example: '123456', description: '6-digit OTP code' })
    @IsNotEmpty()
    @IsString()
    code: string;
}

export class RefreshTokenDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    refreshToken: string;
}

export class SwitchRoleDto {
    @ApiProperty({ enum: ['SEEKER', 'PATIENT'] })
    @IsEnum(UserRole)
    newRole: UserRole;
}

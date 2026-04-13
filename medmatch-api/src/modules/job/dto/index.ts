import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsBoolean,
    IsDateString,
    Min,
    Max,
    IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LicenseType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateJobDto {
    @ApiProperty({ example: 'ทันตแพทย์ Part-time วันเสาร์' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ enum: LicenseType })
    @IsEnum(LicenseType)
    specialtyRequired: LicenseType;

    @ApiProperty({ example: '2026-03-15' })
    @IsDateString()
    workDate: string;

    @ApiProperty({ example: '09:00' })
    @IsString()
    startTime: string;

    @ApiProperty({ example: '17:00' })
    @IsString()
    endTime: string;

    @ApiPropertyOptional({ example: 5000 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    payAmount?: number;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    payNegotiable?: boolean;

    @ApiPropertyOptional({ example: 13.7563 })
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiPropertyOptional({ example: 100.5018 })
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    slots?: number;
}

export class BrowseJobsDto {
    @ApiPropertyOptional({ example: 13.7563, description: 'Omit for nationwide search' })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    latitude?: number;

    @ApiPropertyOptional({ example: 100.5018, description: 'Omit for nationwide search' })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    longitude?: number;

    @ApiPropertyOptional({ example: 10, description: 'Radius in km. Omit (with lat/lng) for nationwide.' })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(500)
    radiusKm?: number;

    @ApiPropertyOptional({ enum: LicenseType })
    @IsOptional()
    @IsEnum(LicenseType)
    specialty?: LicenseType;

    @ApiPropertyOptional({ example: '2026-03-15' })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({ example: 3000 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    minPay?: number;

    @ApiPropertyOptional({
        enum: ['distance', 'pay', 'rating', 'newest'],
        default: 'distance',
    })
    @IsOptional()
    @IsString()
    sortBy?: 'distance' | 'pay' | 'rating' | 'newest';

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(50)
    limit?: number;
}

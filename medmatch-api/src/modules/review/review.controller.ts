import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Query,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReviewController {
    constructor(private readonly prisma: PrismaService) { }

    @Post()
    @ApiOperation({ summary: 'Create a review' })
    async createReview(
        @CurrentUser() user: JwtPayload,
        @Body()
        body: {
            matchId?: string;
            bookingId?: string;
            revieweeId: string;
            rating: number;
            comment?: string;
        },
    ) {
        if (body.rating < 1 || body.rating > 5) {
            throw new BadRequestException('Rating must be 1-5');
        }

        const review = await this.prisma.review.create({
            data: {
                match_id: body.matchId,
                booking_id: body.bookingId,
                reviewer_id: user.sub,
                reviewee_id: body.revieweeId,
                rating: body.rating,
                comment: body.comment,
            },
        });

        // Update average rating for the reviewee
        const stats = await this.prisma.review.aggregate({
            where: { reviewee_id: body.revieweeId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        // Update seeker or clinic profile rating
        await this.prisma.seekerProfile.updateMany({
            where: { user_id: body.revieweeId },
            data: {
                rating_avg: stats._avg.rating ?? 0,
                rating_count: stats._count.rating,
            },
        });
        await this.prisma.clinicProfile.updateMany({
            where: { user_id: body.revieweeId },
            data: {
                rating_avg: stats._avg.rating ?? 0,
                rating_count: stats._count.rating,
            },
        });

        return review;
    }

    @Get('user/:id')
    @ApiOperation({ summary: 'Get reviews for a user' })
    async getUserReviews(
        @Param('id') userId: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [reviews, total] = await Promise.all([
            this.prisma.review.findMany({
                where: { reviewee_id: userId },
                orderBy: { created_at: 'desc' },
                skip,
                take: parseInt(limit),
                include: {
                    reviewer: {
                        select: {
                            seeker_profile: {
                                select: { first_name: true, last_name: true, profile_image_url: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.review.count({ where: { reviewee_id: userId } }),
        ]);

        return { data: reviews, total, page: parseInt(page) };
    }

    @Get('clinic-profile/:id')
    @ApiOperation({ summary: 'Get reviews for a clinic by profile ID' })
    async getClinicProfileReviews(
        @Param('id') clinicProfileId: string,
        @Query('limit') limit = '10',
    ) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { id: clinicProfileId },
            select: { user_id: true, rating_avg: true, rating_count: true },
        });
        if (!clinic) return { data: [], total: 0, rating_avg: 0, rating_count: 0 };

        const [reviews, total] = await Promise.all([
            this.prisma.review.findMany({
                where: { reviewee_id: clinic.user_id },
                orderBy: { created_at: 'desc' },
                take: parseInt(limit),
                include: {
                    reviewer: {
                        select: {
                            patient_profile: { select: { first_name_enc: true, last_name_enc: true } },
                            seeker_profile: { select: { first_name: true, last_name: true } },
                        },
                    },
                },
            }),
            this.prisma.review.count({ where: { reviewee_id: clinic.user_id } }),
        ]);

        return {
            data: reviews,
            total,
            rating_avg: clinic.rating_avg ?? 0,
            rating_count: clinic.rating_count ?? 0,
        };
    }

    @Post(':id/report')
    @ApiOperation({ summary: 'Report an inappropriate review' })
    async reportReview(@Param('id') reviewId: string) {
        return this.prisma.review.update({
            where: { id: reviewId },
            data: { reported: true },
        });
    }
}

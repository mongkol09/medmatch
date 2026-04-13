import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { JobModule } from './modules/job/job.module';
import { BookingModule } from './modules/booking/booking.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewModule } from './modules/review/review.module';
import { MapModule } from './modules/map/map.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting (per IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100,  // 100 requests per minute
      },
    ]),

    // Scheduled tasks (auto-expire jobs, etc.)
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    ProfileModule,
    JobModule,
    BookingModule,
    ChatModule,
    PaymentModule,
    ReviewModule,
    MapModule,
    NotificationModule,
  ],
})
export class AppModule { }

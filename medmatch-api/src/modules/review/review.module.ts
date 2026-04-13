import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ReviewController],
})
export class ReviewModule { }

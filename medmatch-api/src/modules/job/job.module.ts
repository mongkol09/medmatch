import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobSchedulerService } from './job-scheduler.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [AuthModule, NotificationModule],
    controllers: [JobController],
    providers: [JobService, JobSchedulerService],
    exports: [JobService],
})
export class JobModule { }

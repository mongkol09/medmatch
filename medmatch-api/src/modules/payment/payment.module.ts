import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SlipVerificationService } from './slip-verification.service';
import { AuthModule } from '../auth/auth.module';
import { AuditLogService } from '../../security/audit-log.service';
import { StorageService } from '../../services/storage.service';

@Module({
    imports: [AuthModule, ConfigModule],
    controllers: [PaymentController],
    providers: [PaymentService, SlipVerificationService, AuditLogService, StorageService],
    exports: [PaymentService],
})
export class PaymentModule { }

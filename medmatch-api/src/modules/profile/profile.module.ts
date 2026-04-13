import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
    SeekerProfileController,
    ClinicProfileController,
    PatientProfileController,
} from './profile.controller';
import { ProfileBridgeController } from './profile.bridge.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogService } from '../../security/audit-log.service';
import { EncryptionService } from '../../security/encryption.service';
import { StorageService } from '../../services/storage.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
    imports: [
        AuthModule,
        ConfigModule,
        MulterModule.register({ storage: memoryStorage() }),
    ],
    controllers: [
        SeekerProfileController,
        ClinicProfileController,
        PatientProfileController,
        ProfileBridgeController,
    ],
    providers: [AuditLogService, EncryptionService, StorageService],
})
export class ProfileModule { }

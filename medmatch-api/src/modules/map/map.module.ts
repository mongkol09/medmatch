import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [MapController],
})
export class MapModule { }

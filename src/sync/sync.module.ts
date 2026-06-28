import { Module } from '@nestjs/common';
import { SyncProcessor } from './sync.processor';
import { SyncController } from './sync.controller';
import { AuthModule } from '../auth/auth.module';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    AuthModule,

    BullModule.registerQueue({
      name: 'sync-queue',
    }),
  ],

  controllers: [SyncController],

  providers: [SyncProcessor],
})
export class SyncModule {}

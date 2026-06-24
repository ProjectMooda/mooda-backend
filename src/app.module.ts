import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    SyncModule,
    AuthModule, // 👈 여기 배열 안에 꼭 들어가야 합니다!
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

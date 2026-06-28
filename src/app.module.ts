import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    SyncModule,
    AuthModule,
    RedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // 프로젝트 루트의 .env 파일 로드
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

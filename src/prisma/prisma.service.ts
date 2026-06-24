import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 💡 [추가된 부분] pg 드라이버가 DATABASE_URL을 읽을 수 있도록 .env 파일을 강제로 즉시 로드합니다.
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pgPool: Pool;

  constructor() {
    // 이제 process.env.DATABASE_URL이 절대 undefined가 되지 않습니다!
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['query', 'info', 'warn', 'error'],
    });

    this.pgPool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    // Prisma 연결 종료 후, 백그라운드의 pg 풀도 확실하게 닫아줍니다.
    await this.pgPool.end();
  }
}

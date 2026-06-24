import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncPayloadDto } from './dto/sync-payload.dto';
import { Goal, Milestone, Schedule } from '@prisma/client'; // 👈 타입 임포트

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async processSync(userId: string, payload: SyncPayloadDto) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // ==========================================
        // 1. UPSERT (생성 및 수정)
        // ==========================================

        if (payload.goals?.upsert?.length) {
          // 💡 수정됨: as Goal[] 을 붙여서 타입을 명확히 알려줍니다.
          for (const goal of payload.goals.upsert as Goal[]) {
            await tx.goal.upsert({
              where: { id: goal.id },
              update: { ...goal, userId },
              create: { ...goal, userId },
            });
          }
        }

        if (payload.milestones?.upsert?.length) {
          // 💡 수정됨: as Milestone[] 추가
          for (const ms of payload.milestones.upsert as Milestone[]) {
            await tx.milestone.upsert({
              where: { id: ms.id },
              update: { ...ms, userId },
              create: { ...ms, userId },
            });
          }
        }

        if (payload.schedules?.upsert?.length) {
          // 💡 수정됨: as Schedule[] 추가
          for (const sch of payload.schedules.upsert as Schedule[]) {
            await tx.schedule.upsert({
              where: { id: sch.id },
              update: { ...sch, userId },
              create: { ...sch, userId },
            });
          }
        }

        // ==========================================
        // 2. DELETE (삭제)
        // ==========================================

        if (payload.schedules?.deletedIds?.length) {
          await tx.schedule.deleteMany({
            where: { id: { in: payload.schedules.deletedIds }, userId },
          });
        }

        if (payload.milestones?.deletedIds?.length) {
          await tx.milestone.deleteMany({
            where: { id: { in: payload.milestones.deletedIds }, userId },
          });
        }

        if (payload.goals?.deletedIds?.length) {
          await tx.goal.deleteMany({
            where: { id: { in: payload.goals.deletedIds }, userId },
          });
        }
      });

      return { success: true, message: '오프라인 동기화가 완료되었습니다.' };
    } catch (error) {
      console.error('동기화 실패:', error);
      throw new InternalServerErrorException(
        '데이터 동기화 중 오류가 발생했습니다.',
      );
    }
  }
}

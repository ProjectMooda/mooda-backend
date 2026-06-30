import { Injectable } from '@nestjs/common';
import type { Category } from '@prisma/client'; // ✅ Prisma 타입 임포트
import type { SyncJobDto } from '../dto/sync.dto';
import type { ISyncHandler, PrismaTx } from '../interfaces/sync.interface';

@Injectable()
export class CategoryHandler implements ISyncHandler {
  async handle(
    tx: PrismaTx,
    userId: string,
    syncJob: SyncJobDto,
  ): Promise<void> {
    const { targetId, action, payload } = syncJob;

    // ✅ ESLint도 만족하고 Prisma 스키마와도 동기화되는 가장 깔끔한 방식!
    const data = (payload || {}) as Partial<Category>;

    if (action === 'CREATE') {
      const exists = await tx.category.findUnique({ where: { id: targetId } });
      if (!exists) {
        await tx.category.create({
          data: {
            id: targetId,
            userId,
            label: data.label || '',
            emoji: data.emoji || '',
          },
        });
      }
    } else if (action === 'UPDATE') {
      await tx.category.updateMany({
        where: { id: targetId, userId },
        data: { label: data.label, emoji: data.emoji },
      });
    } else if (action === 'DELETE') {
      await tx.category.updateMany({
        where: { id: targetId, userId },
        data: { deletedAt: new Date() },
      });
    }
  }
}

import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 동기화 대상 엔티티 타입 */
export type SyncEntity =
  | 'schedule'
  | 'goal'
  | 'milestone'
  | 'category'
  | 'priority';

/** 동기화 액션 타입 */
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export class SyncJobDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string;

  @IsEnum(['schedule', 'goal', 'milestone', 'category', 'priority'])
  entity!: SyncEntity;

  @IsEnum(['CREATE', 'UPDATE', 'DELETE'])
  action!: SyncAction;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;

  @IsNumber()
  @IsNotEmpty()
  timestamp!: number; // 프론트엔드 액션 발생 시간 (ms)
}

export class SyncRequestDto {
  @ValidateNested({ each: true })
  @Type(() => SyncJobDto)
  jobs!: SyncJobDto[];
}

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

export class SyncJobDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string;

  @IsEnum(['schedule', 'goal', 'milestone', 'category', 'priority'])
  entity!: 'schedule' | 'goal' | 'milestone' | 'category' | 'priority';

  @IsEnum(['CREATE', 'UPDATE', 'DELETE'])
  action!: 'CREATE' | 'UPDATE' | 'DELETE';

  @IsString()
  @IsNotEmpty()
  targetId!: string; // 프론트엔드에서 생성한 UUID / 커스텀 ID

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>; // 각 엔티티별 데이터 객체

  @IsNumber()
  @IsNotEmpty()
  timestamp!: number; // 프론트엔드 액션 발생 시간 (밀리초)
}

export class SyncRequestDto {
  @ValidateNested({ each: true })
  @Type(() => SyncJobDto)
  jobs!: SyncJobDto[];
}

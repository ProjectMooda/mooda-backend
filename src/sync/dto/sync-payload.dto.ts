// src/sync/dto/sync-payload.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SyncEntityDto {
  @IsArray()
  @IsOptional()
  upsert?: any[]; // 생성 및 수정할 데이터 (프론트엔드 UUID 기준)

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deletedIds?: string[]; // 삭제된 데이터의 UUID 배열
}

export class SyncPayloadDto {
  @ValidateNested()
  @Type(() => SyncEntityDto)
  @IsOptional()
  goals?: SyncEntityDto;

  @ValidateNested()
  @Type(() => SyncEntityDto)
  @IsOptional()
  milestones?: SyncEntityDto;

  @ValidateNested()
  @Type(() => SyncEntityDto)
  @IsOptional()
  schedules?: SyncEntityDto;
}

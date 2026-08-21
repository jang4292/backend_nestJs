// src/music/dto/list-tracks-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const SORTABLE_COLUMNS = [
  'id',
  'title',
  'artistName',
  'bpm',
  'createdAt',
] as const;
export type TrackSortColumn = (typeof SORTABLE_COLUMNS)[number];

export class ListTracksQueryDto {
  @ApiPropertyOptional({ description: 'title/artist 통합 검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '아티스트 ID 필터' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  artistId?: number;

  @ApiPropertyOptional({ description: '아티스트명 필터' })
  @IsOptional()
  @IsString()
  artistName?: string;

  @ApiPropertyOptional({ description: '곡 제목 필터' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '최소 BPM' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBpm?: number;

  @ApiPropertyOptional({ description: '최대 BPM' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBpm?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SORTABLE_COLUMNS, default: 'id' })
  @IsOptional()
  @IsIn(SORTABLE_COLUMNS)
  sortBy?: TrackSortColumn = 'id';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

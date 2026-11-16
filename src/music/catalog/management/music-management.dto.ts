import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class NameDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
export class WorkDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
}
export class RecordingDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  workId?: number | null;
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  artistIds?: number[];
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  recordingType?: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recordingLocation?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  recordingDate?: string;
}
export class PlaylistItemAssetDto {
  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  audioAssetId!: number | null;
}
export class UsageDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt()
  @Min(1)
  playlistId!: number;
  @ApiProperty({
    format: 'date-time',
    description: 'ISO 8601 including timezone',
  })
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d\d:\d\d)$/i)
  usedAt!: string;
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location!: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventName?: string;
}
export class UsageItemDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 10000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  playCount!: number;
}
export class StatisticsQueryDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive ISO 8601 timestamp with timezone',
  })
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d\d:\d\d)$/i)
  from!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Exclusive ISO 8601 timestamp with timezone',
  })
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d\d:\d\d)$/i)
  to!: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCatalogTrackDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @MinLength(1)
  @MaxLength(200)
  artist!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(400)
  bpm?: number;
}

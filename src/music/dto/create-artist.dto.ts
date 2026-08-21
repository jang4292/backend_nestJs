import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateArtistDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @MaxLength(500)
  description?: string;
}

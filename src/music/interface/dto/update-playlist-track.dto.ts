import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlaylistTrackDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seq?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTrackToPlaylistDto {
  @ApiProperty({ type: 'integer', minimum: 1 })
  @IsInt()
  @Min(1)
  trackId: number;

  @ApiProperty({ type: 'integer', minimum: 1 })
  @IsInt()
  @Min(1)
  seq: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

// src/music/dto/create-track.dto.ts
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTrackDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  artist: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bpm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthSec?: number;
}

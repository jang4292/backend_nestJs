import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddTrackToPlaylistDto {
  @IsInt()
  @Min(1)
  trackId: number;

  @IsInt()
  @Min(1)
  seq: number;

  @IsOptional()
  @IsString()
  note?: string;
}

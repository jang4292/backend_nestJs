import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePlaylistTrackDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  seq?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

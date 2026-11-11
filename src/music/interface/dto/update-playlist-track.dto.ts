import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdatePlaylistTrackDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  seq?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

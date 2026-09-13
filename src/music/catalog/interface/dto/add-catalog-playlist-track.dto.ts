import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCatalogPlaylistTrackDto {
  @IsInt()
  @Min(1)
  trackId!: number;

  @IsInt()
  @Min(1)
  position!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

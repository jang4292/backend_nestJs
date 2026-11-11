import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateCatalogPlaylistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsDateString()
  playDate?: string;

  @IsOptional()
  @IsBoolean()
  anonymousPlayable?: boolean;
}

import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreatePlaylistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  // 날짜 기반 플레이리스트면 필수로 사용할 수 있음
  @IsOptional()
  @IsDateString()
  playDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

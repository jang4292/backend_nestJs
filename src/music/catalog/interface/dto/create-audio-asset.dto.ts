import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUrl, Max, Min, MaxLength } from 'class-validator';

export class CreateAudioAssetDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  // http(s) 절대 URL만 받습니다(javascript:, ftp: 등 거부). 컬럼 길이(2000)를 넘으면 DB 오류 대신 400입니다.
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  @MaxLength(2000)
  url?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: 400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(400)
  bpm?: number;
}

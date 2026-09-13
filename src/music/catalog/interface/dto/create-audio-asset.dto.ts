import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';

export class CreateAudioAssetDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(400)
  bpm?: number;
}

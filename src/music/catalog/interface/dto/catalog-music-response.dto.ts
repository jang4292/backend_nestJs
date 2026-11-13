import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogTrackSummaryResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  artist!: string;

  @ApiProperty({ type: 'integer', nullable: true })
  bpm!: number | null;
}

export class CatalogTrackResponseDto extends CatalogTrackSummaryResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class AudioAssetResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiPropertyOptional({ type: CatalogTrackResponseDto })
  track?: CatalogTrackResponseDto;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  @ApiProperty({ type: 'integer', nullable: true })
  duration!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  bpm!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CatalogPlaylistResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  playDate!: string | null;

  @ApiProperty({ enum: ['draft', 'published', 'archived'] })
  status!: 'draft' | 'published' | 'archived';

  @ApiProperty()
  anonymousPlayable!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CatalogPlaylistTrackResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiPropertyOptional({ type: CatalogPlaylistResponseDto })
  playlist?: CatalogPlaylistResponseDto;

  @ApiPropertyOptional({ type: CatalogTrackResponseDto })
  track?: CatalogTrackResponseDto;

  @ApiProperty({ type: 'integer' })
  position!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class DeleteResourceResponseDto {
  @ApiProperty({ enum: [true], example: true })
  deleted!: true;

  @ApiProperty({ type: 'integer' })
  id!: number;
}

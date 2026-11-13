import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LegacyArtistResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class LegacyTrackResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: LegacyArtistResponseDto })
  artist!: LegacyArtistResponseDto;

  @ApiProperty({ type: 'integer', nullable: true })
  bpm!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  lengthSec!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class LegacyPlaylistSummaryResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  playDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class LegacyPlaylistTrackResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiPropertyOptional({ type: LegacyPlaylistSummaryResponseDto })
  playlist?: LegacyPlaylistSummaryResponseDto;

  @ApiProperty({ type: LegacyTrackResponseDto })
  track!: LegacyTrackResponseDto;

  @ApiProperty({ type: 'integer' })
  seq!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class LegacyPlaylistResponseDto extends LegacyPlaylistSummaryResponseDto {
  @ApiPropertyOptional({ type: [LegacyPlaylistTrackResponseDto] })
  playlistTracks?: LegacyPlaylistTrackResponseDto[];
}

export class LegacyPlaylistTrackSummaryTrackResponseDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  artist!: string;

  @ApiProperty({ type: 'integer', nullable: true })
  bpm!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  lengthSec!: number | null;
}

export class LegacyPlaylistTrackSummaryResponseDto {
  @ApiProperty({ type: 'integer' })
  playlistTrackId!: number;

  @ApiProperty({ type: 'integer' })
  seq!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: LegacyPlaylistTrackSummaryTrackResponseDto })
  track!: LegacyPlaylistTrackSummaryTrackResponseDto;
}

export class LegacyDeleteResponseDto {
  @ApiProperty({ enum: [true], example: true })
  deleted!: true;

  @ApiProperty({ type: 'integer' })
  id!: number;
}

export class LegacyPlaylistTrackDeleteResponseDto {
  @ApiProperty({ enum: [true], example: true })
  deleted!: true;

  @ApiProperty({ type: 'integer' })
  playlistTrackId!: number;
}

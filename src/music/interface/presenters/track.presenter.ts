import { ApiProperty } from '@nestjs/swagger';

export class TrackArtistSummary {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  name!: string;
}

export class PublicTrackResponse {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: TrackArtistSummary })
  artist!: TrackArtistSummary;

  @ApiProperty({ type: 'integer', nullable: true })
  bpm!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  lengthSec!: number | null;
}

export class FullTrackResponse extends PublicTrackResponse {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class PaginatedPublicTracks {
  @ApiProperty({ type: [PublicTrackResponse] })
  items!: PublicTrackResponse[];

  @ApiProperty({ type: 'integer' })
  total!: number;

  @ApiProperty({ type: 'integer' })
  page!: number;

  @ApiProperty({ type: 'integer' })
  limit!: number;
}

export class PaginatedFullTracks {
  @ApiProperty({ type: [FullTrackResponse] })
  items!: FullTrackResponse[];

  @ApiProperty({ type: 'integer' })
  total!: number;

  @ApiProperty({ type: 'integer' })
  page!: number;

  @ApiProperty({ type: 'integer' })
  limit!: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CatalogPlaylist } from '../../entities/catalog-playlist.entity';

export class PublicPlaylistTrackCatalogTrackResponse {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  artist!: string;

  @ApiProperty({ type: 'integer', nullable: true })
  bpm!: number | null;
}

export class PublicPlaylistTrackResponse {
  @ApiProperty({ type: 'integer' })
  position!: number;

  @ApiProperty({ type: PublicPlaylistTrackCatalogTrackResponse })
  track!: PublicPlaylistTrackCatalogTrackResponse;
}

export class PublicPlaylistResponse {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  playDate!: string | null;

  @ApiProperty()
  anonymousPlayable!: boolean;

  @ApiProperty({ type: 'integer' })
  trackCount!: number;

  @ApiPropertyOptional({ type: [PublicPlaylistTrackResponse] })
  tracks?: PublicPlaylistTrackResponse[];
}

export class PaginatedPublicPlaylistsResponse {
  @ApiProperty({ type: [PublicPlaylistResponse] })
  items!: PublicPlaylistResponse[];

  @ApiProperty({ type: 'integer' })
  total!: number;

  @ApiProperty({ type: 'integer' })
  page!: number;

  @ApiProperty({ type: 'integer' })
  limit!: number;
}

export function toPublicPlaylistResponse(
  playlist: CatalogPlaylist,
  includeTracks = true,
): PublicPlaylistResponse {
  // 공개 필드만 선택해 Entity의 URL이나 내부 저장소 정보가 노출되지 않게 합니다.
  const items = [...(playlist.playlistItems ?? [])].sort(
    (left, right) => left.position - right.position,
  );

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    playDate: playlist.playDate,
    anonymousPlayable: playlist.anonymousPlayable,
    trackCount: items.length,
    ...(includeTracks
      ? {
          tracks: items.map((item) => ({
            position: item.position,
            track: {
              id: item.track.id,
              title: item.track.title,
              artist: item.track.artist,
              bpm: item.track.bpm,
            },
          })),
        }
      : {}),
  };
}

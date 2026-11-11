import type { CatalogPlaylist } from '../../entities/catalog-playlist.entity';

export interface PublicPlaylistTrackResponse {
  position: number;
  track: {
    id: number;
    title: string;
    artist: string;
    bpm: number | null;
  };
}

export interface PublicPlaylistResponse {
  id: number;
  title: string;
  description: string | null;
  playDate: string | null;
  anonymousPlayable: boolean;
  trackCount: number;
  tracks?: PublicPlaylistTrackResponse[];
}

export interface PaginatedPublicPlaylistsResponse {
  items: PublicPlaylistResponse[];
  total: number;
  page: number;
  limit: number;
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

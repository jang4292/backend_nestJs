interface TrackArtistSummary {
  id: number;
  name: string;
}

export interface PublicTrackResponse {
  id: number;
  title: string;
  artist: TrackArtistSummary;
  bpm: number | null;
  lengthSec: number | null;
}

export interface FullTrackResponse extends PublicTrackResponse {
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedPublicTracks {
  items: PublicTrackResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedFullTracks {
  items: FullTrackResponse[];
  total: number;
  page: number;
  limit: number;
}

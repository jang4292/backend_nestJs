import { AudioAsset } from '../../entities/audio-asset.entity';
import { CatalogTrack } from '../../entities/catalog-track.entity';

export const AUDIO_ASSET_REPOSITORY_PORT = Symbol('AudioAssetRepositoryPort');

export interface AudioAssetRepositoryPort {
  create(data: {
    track: CatalogTrack;
    url: string | null;
    duration: number | null;
    bpm: number | null;
  }): AudioAsset;
  save(audioAsset: AudioAsset): Promise<AudioAsset>;
  findById(id: number): Promise<AudioAsset | null>;
  findByTrackId(trackId: number): Promise<AudioAsset[]>;
  remove(audioAsset: AudioAsset): Promise<void>;
}

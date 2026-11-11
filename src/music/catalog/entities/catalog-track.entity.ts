import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AudioAsset } from './audio-asset.entity';
import { CatalogPlaylistTrack } from './catalog-playlist-track.entity';

@Entity('track')
export class CatalogTrack {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 200 })
  title!: string;

  @Column({ length: 200 })
  artist!: string;

  @Column({ type: 'int', nullable: true })
  bpm!: number | null;

  @OneToMany(() => AudioAsset, (audioAsset) => audioAsset.track)
  audioAssets!: AudioAsset[];

  @OneToMany(() => CatalogPlaylistTrack, (playlistItem) => playlistItem.track)
  playlistItems!: CatalogPlaylistTrack[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

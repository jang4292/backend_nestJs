import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
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

  @Column({ type: 'int', nullable: true })
  workId!: number | null;

  @ManyToOne('MusicWork', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'workId',
    foreignKeyConstraintName: 'FK_music_track_work',
  })
  work?: unknown;

  @Column({ type: 'varchar', length: 50, nullable: true })
  recordingType!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  recordingLocation!: string | null;

  @Column({ type: 'date', nullable: true })
  recordingDate!: string | null;

  @OneToMany(() => AudioAsset, (audioAsset) => audioAsset.track)
  audioAssets!: AudioAsset[];

  @OneToMany(() => CatalogPlaylistTrack, (playlistItem) => playlistItem.track)
  playlistItems!: CatalogPlaylistTrack[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

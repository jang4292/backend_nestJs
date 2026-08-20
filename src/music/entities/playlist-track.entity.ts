// src/music/entities/playlist-track.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';
import { Track } from './track.entity';

@Entity('playlist_track')
export class PlaylistTrack {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Playlist, (playlist) => playlist.playlistTracks, {
    onDelete: 'CASCADE',
  })
  playlist!: Playlist;

  @ManyToOne(() => Track, (track) => track.playlistTracks, {
    onDelete: 'CASCADE',
  })
  track!: Track;

  @Column()
  seq!: number; // 재생 순서

  @Column({ length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

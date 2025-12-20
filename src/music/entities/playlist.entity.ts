// src/music/entities/playlist.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaylistTrack } from './playlist-track.entity';

@Entity('playlist')
export class Playlist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  // 특정 날짜용 플레이리스트라면 사용 (예: 2025-12-24 크리스마스 세트)
  @Column({ type: 'date', nullable: true })
  playDate: string | null;

  @Column({ length: 500, nullable: true })
  description: string | null;

  @OneToMany(() => PlaylistTrack, (pt) => pt.playlist)
  playlistTracks: PlaylistTrack[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

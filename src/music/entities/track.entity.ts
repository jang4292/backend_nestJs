// src/music/entities/track.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaylistTrack } from './playlist-track.entity';
import { Artist } from './artist.entity';

@Entity('track')
export class Track {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 200 })
  title!: string;

  @ManyToOne(() => Artist, (artist) => artist.tracks, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: true,
  })
  artist!: Artist;

  @Column({ type: 'int', nullable: true })
  bpm!: number | null;

  @Column({ type: 'int', nullable: true })
  lengthSec!: number | null;

  @OneToMany(() => PlaylistTrack, (pt) => pt.track)
  playlistTracks!: PlaylistTrack[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

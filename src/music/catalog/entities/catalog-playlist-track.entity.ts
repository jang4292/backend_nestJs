import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogTrack } from './catalog-track.entity';
import { CatalogPlaylist } from './catalog-playlist.entity';

@Entity('playlist_track')
export class CatalogPlaylistTrack {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => CatalogPlaylist, (playlist) => playlist.playlistItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'playlistId' })
  playlist!: CatalogPlaylist;

  @ManyToOne(() => CatalogTrack, (track) => track.playlistItems, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'trackId' })
  track!: CatalogTrack;

  @Column({ type: 'int' })
  // 한 Playlist 안의 재생 순서이며 DB unique index로 중복을 막습니다.
  position!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

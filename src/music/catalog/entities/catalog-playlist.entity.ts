import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogPlaylistTrack } from './catalog-playlist-track.entity';

export type CatalogPlaylistStatus = 'draft' | 'published' | 'archived';

@Entity('playlist')
export class CatalogPlaylist {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'date', nullable: true })
  playDate!: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  })
  // draft는 작성 중, published는 공개, archived는 공개 대상에서 제외합니다.
  status!: CatalogPlaylistStatus;

  @Column({ type: 'boolean', default: false })
  // 현재는 정책 값만 저장하며 익명 playback API는 아직 구현하지 않습니다.
  anonymousPlayable!: boolean;

  @Column({ type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @OneToMany(() => CatalogPlaylistTrack, (item) => item.playlist)
  playlistItems!: CatalogPlaylistTrack[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

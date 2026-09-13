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

@Entity('audio_asset')
export class AudioAsset {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => CatalogTrack, (track) => track.audioAssets, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trackId' })
  track!: CatalogTrack;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  url!: string | null;

  @Column({ type: 'int', nullable: true })
  duration!: number | null;

  @Column({ type: 'int', nullable: true })
  bpm!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

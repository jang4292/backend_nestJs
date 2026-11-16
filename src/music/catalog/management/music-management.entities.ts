import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('music_artist')
export class MusicArtist {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 200 }) name!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity('music_artist_alias')
@Index('IDX_music_artist_alias_artist', ['artistId'])
export class MusicArtistAlias {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) artistId!: number;
  @ManyToOne('MusicArtist', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'artistId',
    foreignKeyConstraintName: 'FK_music_alias_artist',
  })
  artist?: unknown;
  @Column({ length: 200 }) name!: string;
}

@Entity('music_work')
export class MusicWork {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 200 }) title!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity('music_track_artist')
@Index('UQ_music_track_artist', ['trackId', 'artistId'], { unique: true })
export class MusicTrackArtist {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) trackId!: number;
  @Column({ type: 'int' }) artistId!: number;
  @ManyToOne('CatalogTrack', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'trackId',
    foreignKeyConstraintName: 'FK_music_track_artist_track',
  })
  track?: unknown;
  @ManyToOne('MusicArtist', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'artistId',
    foreignKeyConstraintName: 'FK_music_track_artist_artist',
  })
  artist?: unknown;
}

@Entity('music_playlist_usage')
@Index('IDX_music_usage_date', ['usedAt'])
export class MusicPlaylistUsage {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) playlistId!: number;
  @ManyToOne('CatalogPlaylist', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'playlistId',
    foreignKeyConstraintName: 'FK_music_usage_playlist',
  })
  playlist?: unknown;
  @Column({ length: 200 }) playlistTitle!: string;
  @Column({ type: 'datetime' }) usedAt!: Date;
  @Column({ length: 200 }) location!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) eventName!:
    string | null;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status!:
    'draft' | 'confirmed';
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity('music_playlist_usage_item')
@Index('IDX_music_usage_item_usage', ['usageId'])
export class MusicPlaylistUsageItem {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) usageId!: number;
  @Column({ type: 'int' }) trackId!: number;
  @Column({ type: 'int', nullable: true }) workId!: number | null;
  @Column({ type: 'int', nullable: true }) audioAssetId!: number | null;
  @ManyToOne('MusicPlaylistUsage', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usageId',
    foreignKeyConstraintName: 'FK_music_usage_item_usage',
  })
  usage?: unknown;
  @ManyToOne('CatalogTrack', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'trackId',
    foreignKeyConstraintName: 'FK_music_usage_item_track',
  })
  track?: unknown;
  @ManyToOne('MusicWork', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'workId',
    foreignKeyConstraintName: 'FK_music_usage_item_work',
  })
  work?: unknown;
  @ManyToOne('AudioAsset', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'audioAssetId',
    foreignKeyConstraintName: 'FK_music_usage_item_asset',
  })
  audioAsset?: unknown;
  @Column({ length: 200 }) trackTitle!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) workTitle!:
    string | null;
  @Column({ type: 'int' }) position!: number;
  @Column({ type: 'int', default: 1 }) playCount!: number;
}

@Entity('music_usage_item_artist')
@Index('UQ_music_usage_item_artist', ['usageItemId', 'artistId'], {
  unique: true,
})
export class MusicUsageItemArtist {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) usageItemId!: number;
  @Column({ type: 'int' }) artistId!: number;
  @ManyToOne('MusicPlaylistUsageItem', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usageItemId',
    foreignKeyConstraintName: 'FK_music_usage_artist_item',
  })
  usageItem?: unknown;
  @ManyToOne('MusicArtist', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'artistId',
    foreignKeyConstraintName: 'FK_music_usage_artist_artist',
  })
  artist?: unknown;
  @Column({ length: 200 }) artistName!: string;
}

export const musicManagementEntities = [
  MusicArtist,
  MusicArtistAlias,
  MusicWork,
  MusicTrackArtist,
  MusicPlaylistUsage,
  MusicPlaylistUsageItem,
  MusicUsageItemArtist,
];

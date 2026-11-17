import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { CatalogTrack } from '../entities/catalog-track.entity';
import { CatalogPlaylist } from '../entities/catalog-playlist.entity';
import { CatalogPlaylistTrack } from '../entities/catalog-playlist-track.entity';
import { AudioAsset } from '../entities/audio-asset.entity';
import {
  MusicArtist,
  MusicArtistAlias,
  MusicPlaylistUsage,
  MusicPlaylistUsageItem,
  MusicTrackArtist,
  MusicUsageItemArtist,
  MusicWork,
} from './music-management.entities';
import {
  NameDto,
  PlaylistItemAssetDto,
  RecordingDto,
  StatisticsQueryDto,
  UsageDto,
  UsageItemDto,
  WorkDto,
} from './music-management.dto';

@Injectable()
export class MusicManagementService {
  constructor(private readonly db: DataSource) {}

  async createArtist(dto: NameDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Artist name is required');
    return this.db.getRepository(MusicArtist).save({ name });
  }
  async artists(query?: string) {
    const qb = this.db
      .getRepository(MusicArtist)
      .createQueryBuilder('a')
      .orderBy('a.name')
      .take(100);
    if (query?.trim()) {
      const pattern = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.where(
        "a.name LIKE :pattern ESCAPE '\\\\' OR EXISTS (SELECT 1 FROM music_artist_alias alias WHERE alias.artistId = a.id AND alias.name LIKE :pattern ESCAPE '\\\\')",
        { pattern },
      );
    }
    return qb.getMany();
  }
  async addAlias(artistId: number, dto: NameDto) {
    if (!(await this.db.getRepository(MusicArtist).existsBy({ id: artistId })))
      throw new NotFoundException('Artist not found');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Alias is required');
    return this.db.getRepository(MusicArtistAlias).save({ artistId, name });
  }
  aliases(artistId: number) {
    return this.db.getRepository(MusicArtistAlias).findBy({ artistId });
  }
  async createWork(dto: WorkDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Work title is required');
    return this.db.getRepository(MusicWork).save({ title });
  }
  works() {
    return this.db
      .getRepository(MusicWork)
      .find({ order: { title: 'ASC' }, take: 100 });
  }
  async updateRecording(id: number, dto: RecordingDto) {
    return this.db.transaction(async (manager) => {
      const track = await manager.findOne(CatalogTrack, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!track) throw new NotFoundException('Track not found');
      if (
        dto.workId != null &&
        !(await manager.existsBy(MusicWork, { id: dto.workId }))
      )
        throw new NotFoundException('Work not found');
      if (dto.artistIds !== undefined) {
        const artists = dto.artistIds.length
          ? await manager.findBy(MusicArtist, { id: In(dto.artistIds) })
          : [];
        if (artists.length !== dto.artistIds.length)
          throw new BadRequestException('An artist was not found');
        await manager.delete(MusicTrackArtist, { trackId: id });
        if (artists.length)
          await manager.save(
            MusicTrackArtist,
            artists.map((a) => ({ trackId: id, artistId: a.id })),
          );
      }
      if (dto.workId !== undefined) track.workId = dto.workId;
      if (dto.recordingType !== undefined)
        track.recordingType = dto.recordingType;
      if (dto.recordingLocation !== undefined)
        track.recordingLocation = dto.recordingLocation;
      if (dto.recordingDate !== undefined)
        track.recordingDate = dto.recordingDate;
      return manager.save(track);
    });
  }
  async playlists() {
    return this.db
      .getRepository(CatalogPlaylist)
      .find({ order: { id: 'DESC' }, take: 100 });
  }
  async playlist(id: number) {
    const playlist = await this.db
      .getRepository(CatalogPlaylist)
      .findOneBy({ id });
    if (!playlist) throw new NotFoundException('Playlist not found');
    const items = await this.db.getRepository(CatalogPlaylistTrack).find({
      where: { playlist: { id } },
      relations: { track: true },
      order: { position: 'ASC' },
    });
    return { ...playlist, items };
  }
  async setPlaylistAsset(itemId: number, dto: PlaylistItemAssetDto) {
    return this.db.transaction(async (manager) => {
      const item = await manager.findOne(CatalogPlaylistTrack, {
        where: { id: itemId },
        relations: { track: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Playlist item not found');
      if (dto.audioAssetId != null) {
        // 다른 트랙의 파일이나 URL만 있는 자산을 선택하면 재생 경계가 깨지므로 둘 다 거부합니다.
        // Reject assets from another track and URL-only assets; playback requires a local upload.
        const asset = await manager.findOne(AudioAsset, {
          where: { id: dto.audioAssetId },
          relations: { track: true },
        });
        if (!asset || asset.track.id !== item.track.id)
          throw new BadRequestException(
            'Audio asset does not belong to the track',
          );
        if (!asset.storageKey)
          throw new BadRequestException(
            'Only uploaded audio can be selected for playback',
          );
      }
      item.audioAssetId = dto.audioAssetId ?? null;
      return manager.save(item);
    });
  }
  async createUsage(dto: UsageDto) {
    return this.db.transaction(async (manager) => {
      const playlist = await manager.findOne(CatalogPlaylist, {
        where: { id: dto.playlistId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!playlist) throw new NotFoundException('Playlist not found');
      const items = await manager.find(CatalogPlaylistTrack, {
        where: { playlist: { id: playlist.id } },
        relations: { track: true },
        order: { position: 'ASC' },
      });
      if (!items.length) throw new BadRequestException('Playlist has no items');
      const usage = await manager.save(MusicPlaylistUsage, {
        playlistId: playlist.id,
        playlistTitle: playlist.title,
        usedAt: new Date(dto.usedAt),
        location: dto.location.trim(),
        eventName: dto.eventName?.trim() || null,
        status: 'draft',
      });
      if (!usage.location)
        throw new BadRequestException('Location is required');
      // 원본 이름·참여자가 나중에 바뀌어도 당시 사용 내역을 확인하도록 항목과 이름을 복사합니다.
      // Snapshot item and credit names so later catalog edits do not rewrite usage history.
      for (const item of items) {
        const work =
          item.track.workId == null
            ? null
            : await manager.findOneBy(MusicWork, { id: item.track.workId });
        const snapshot = await manager.save(MusicPlaylistUsageItem, {
          usageId: usage.id,
          trackId: item.track.id,
          workId: work?.id ?? null,
          audioAssetId: item.audioAssetId ?? null,
          trackTitle: item.track.title,
          workTitle: work?.title ?? null,
          position: item.position,
          playCount: 1,
        });
        const credits = await manager.findBy(MusicTrackArtist, {
          trackId: item.track.id,
        });
        if (credits.length) {
          const artists = await manager.findBy(MusicArtist, {
            id: In(credits.map((credit) => credit.artistId)),
          });
          await manager.save(
            MusicUsageItemArtist,
            artists.map((artist) => ({
              usageItemId: snapshot.id,
              artistId: artist.id,
              artistName: artist.name,
            })),
          );
        }
      }
      return usage;
    });
  }
  listUsages() {
    return this.db
      .getRepository(MusicPlaylistUsage)
      .find({ order: { usedAt: 'DESC', id: 'DESC' }, take: 100 });
  }
  async usage(id: number) {
    const usage = await this.db
      .getRepository(MusicPlaylistUsage)
      .findOneBy({ id });
    if (!usage) throw new NotFoundException('Usage not found');
    const items = await this.db
      .getRepository(MusicPlaylistUsageItem)
      .find({ where: { usageId: id }, order: { position: 'ASC', id: 'ASC' } });
    return { ...usage, items };
  }
  async updateUsageItem(usageId: number, itemId: number, dto: UsageItemDto) {
    return this.db.transaction(async (manager) => {
      const usage = await manager.findOne(MusicPlaylistUsage, {
        where: { id: usageId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!usage) throw new NotFoundException('Usage not found');
      if (usage.status !== 'draft')
        throw new BadRequestException('Confirmed usage cannot be edited');
      const item = await manager.findOneBy(MusicPlaylistUsageItem, {
        id: itemId,
        usageId,
      });
      if (!item) throw new NotFoundException('Usage item not found');
      item.playCount = dto.playCount;
      return manager.save(item);
    });
  }
  async confirmUsage(id: number) {
    return this.db.transaction(async (manager) => {
      const usage = await manager.findOne(MusicPlaylistUsage, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!usage) throw new NotFoundException('Usage not found');
      if (usage.status !== 'draft')
        throw new BadRequestException('Usage is already confirmed');
      usage.status = 'confirmed';
      return manager.save(usage);
    });
  }
  async statistics(query: StatisticsQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from >= to) throw new BadRequestException('from must be before to');
    // 확정된 양수 횟수만 [from, to) 구간에 합산합니다. 공동 아티스트는 각자 같은 항목의 횟수를 받습니다.
    // Sum positive counts from confirmed usages in [from, to); each credited artist receives the item count.
    const where = `u.status = 'confirmed' AND u.usedAt >= ? AND u.usedAt < ? AND i.playCount > 0${query.location ? ' AND u.location = ?' : ''}`;
    const params = query.location ? [from, to, query.location] : [from, to];
    const base = `FROM music_playlist_usage u JOIN music_playlist_usage_item i ON i.usageId = u.id`;
    const [recordings, works, assets, artists] = await Promise.all([
      this.db.query<
        { id: number | null; name?: string | null; count: string | number }[]
      >(
        `SELECT i.trackId AS id, MIN(i.trackTitle) AS name, SUM(i.playCount) AS count ${base} WHERE ${where} GROUP BY i.trackId ORDER BY count DESC, id ASC LIMIT 100`,
        params,
      ),
      this.db.query<
        { id: number | null; name?: string | null; count: string | number }[]
      >(
        `SELECT i.workId AS id, MIN(i.workTitle) AS name, SUM(i.playCount) AS count ${base} WHERE ${where} AND i.workId IS NOT NULL GROUP BY i.workId ORDER BY count DESC, id ASC LIMIT 100`,
        params,
      ),
      this.db.query<
        { id: number | null; name?: string | null; count: string | number }[]
      >(
        `SELECT i.audioAssetId AS id, SUM(i.playCount) AS count ${base} WHERE ${where} GROUP BY i.audioAssetId ORDER BY count DESC, id ASC LIMIT 100`,
        params,
      ),
      this.db.query<
        { id: number | null; name?: string | null; count: string | number }[]
      >(
        `SELECT a.artistId AS id, MIN(a.artistName) AS name, SUM(i.playCount) AS count ${base} JOIN music_usage_item_artist a ON a.usageItemId = i.id WHERE ${where} GROUP BY a.artistId ORDER BY count DESC, id ASC LIMIT 100`,
        params,
      ),
    ]);
    const normalize = (rows: { count: string | number }[]) =>
      rows.map((row) => ({ ...row, count: Number(row.count) }));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      location: query.location ?? null,
      recordings: normalize(recordings),
      works: normalize(works),
      assets: normalize(assets),
      artists: normalize(artists),
    };
  }
}

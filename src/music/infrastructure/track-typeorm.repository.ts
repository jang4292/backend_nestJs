import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artist } from '../entities/artist.entity';
import { Track } from '../entities/track.entity';
import {
  PaginatedTracks,
  TrackRepositoryPort,
  TrackSearchCriteria,
} from '../application/ports/track-repository.port';

@Injectable()
export class TrackTypeOrmRepository implements TrackRepositoryPort {
  constructor(
    @InjectRepository(Track)
    private readonly repo: Repository<Track>,
  ) {}

  create(data: {
    title: string;
    artist: Artist;
    bpm: number | null;
    lengthSec: number | null;
  }): Track {
    return this.repo.create(data);
  }

  save(track: Track): Promise<Track> {
    return this.repo.save(track);
  }

  findById(id: number): Promise<Track | null> {
    return this.repo.findOne({ where: { id }, relations: ['artist'] });
  }

  async remove(track: Track): Promise<void> {
    await this.repo.remove(track);
  }

  async search(criteria: TrackSearchCriteria): Promise<PaginatedTracks> {
    const {
      search,
      artistId,
      artistName,
      title,
      minBpm,
      maxBpm,
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'DESC',
    } = criteria;

    const qb = this.repo
      .createQueryBuilder('track')
      .leftJoinAndSelect('track.artist', 'artist');

    if (search) {
      qb.andWhere(
        '(LOWER(track.title) LIKE LOWER(:search) OR LOWER(artist.name) LIKE LOWER(:search))',
        {
          search: `%${escapeLike(search)}%`,
        },
      );
    }
    if (artistId) {
      qb.andWhere('artist.id = :artistId', { artistId });
    }
    if (artistName) {
      qb.andWhere('LOWER(artist.name) LIKE LOWER(:artistName)', {
        artistName: `%${escapeLike(artistName)}%`,
      });
    }
    if (title) {
      qb.andWhere('LOWER(track.title) LIKE LOWER(:title)', {
        title: `%${escapeLike(title)}%`,
      });
    }
    if (minBpm !== undefined) {
      qb.andWhere('track.bpm >= :minBpm', { minBpm });
    }
    if (maxBpm !== undefined) {
      qb.andWhere('track.bpm <= :maxBpm', { maxBpm });
    }

    const sortColumn =
      sortBy === 'artistName' ? 'artist.name' : `track.${sortBy}`;

    qb.orderBy(sortColumn, sortOrder)
      .addOrderBy('track.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }
}

/**
 * LIKE 패턴의 와일드카드(%, _)와 escape 문자(백슬래시)를 문자 그대로 검색하도록 이스케이프합니다.
 * MariaDB의 기본 LIKE escape 문자는 백슬래시입니다. 값은 여전히 바인딩 파라미터로 전달됩니다.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

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
      qb.andWhere('(track.title ILIKE :search OR artist.name ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (artistId) {
      qb.andWhere('artist.id = :artistId', { artistId });
    }
    if (artistName) {
      qb.andWhere('artist.name ILIKE :artistName', {
        artistName: `%${artistName}%`,
      });
    }
    if (title) {
      qb.andWhere('track.title ILIKE :title', { title: `%${title}%` });
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

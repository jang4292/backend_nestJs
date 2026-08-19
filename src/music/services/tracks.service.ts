import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTrackDto } from '../dto/create-track.dto';
import { ListTracksQueryDto } from '../dto/list-tracks-query.dto';
import { UpdateTrackDto } from '../dto/update-track.dto';
import { Track } from '../entities/track.entity';

export interface PaginatedTracks {
  items: Track[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TracksService {
  constructor(
    @InjectRepository(Track)
    private readonly trackRepo: Repository<Track>,
  ) {}

  async createTrack(dto: CreateTrackDto): Promise<Track> {
    const track = this.trackRepo.create(dto);
    return this.trackRepo.save(track);
  }

  async getTrackList(query: ListTracksQueryDto): Promise<PaginatedTracks> {
    const {
      search,
      artist,
      title,
      minBpm,
      maxBpm,
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'DESC',
    } = query;

    const qb = this.trackRepo.createQueryBuilder('track');

    if (search) {
      qb.andWhere('(track.title ILIKE :search OR track.artist ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (artist) {
      qb.andWhere('track.artist ILIKE :artist', { artist: `%${artist}%` });
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

    qb.orderBy(`track.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getTrack(id: number): Promise<Track> {
    const track = await this.trackRepo.findOne({ where: { id } });
    if (!track) throw new NotFoundException('Track not found');
    return track;
  }

  async updateTrack(id: number, dto: UpdateTrackDto): Promise<Track> {
    const track = await this.getTrack(id);
    Object.assign(track, dto);
    return this.trackRepo.save(track);
  }

  async deleteTrack(id: number): Promise<{ deleted: true; id: number }> {
    const track = await this.getTrack(id);
    await this.trackRepo.remove(track);
    return { deleted: true, id };
  }
}

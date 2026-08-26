import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artist } from '../entities/artist.entity';
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
    @InjectRepository(Artist)
    private readonly artistRepo: Repository<Artist>,
  ) {}

  async createTrack(dto: CreateTrackDto): Promise<Track> {
    const artist = await this.getArtistEntity(dto.artistId);
    const track = this.trackRepo.create({
      title: dto.title,
      artist,
      bpm: dto.bpm ?? null,
      lengthSec: dto.lengthSec ?? null,
    });
    return this.trackRepo.save(track);
  }

  async getTrackList(query: ListTracksQueryDto): Promise<PaginatedTracks> {
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
    } = query;

    const qb = this.trackRepo
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

  async getTrack(id: number): Promise<Track> {
    const track = await this.trackRepo.findOne({
      where: { id },
      relations: ['artist'],
    });
    if (!track) throw new NotFoundException('Track not found');
    return track;
  }

  async updateTrack(id: number, dto: UpdateTrackDto): Promise<Track> {
    const track = await this.getTrack(id);

    if (dto.artistId !== undefined) {
      track.artist = await this.getArtistEntity(dto.artistId);
    }

    Object.assign(track, {
      title: dto.title ?? track.title,
      bpm: dto.bpm ?? track.bpm,
      lengthSec: dto.lengthSec ?? track.lengthSec,
    });

    return this.trackRepo.save(track);
  }

  async deleteTrack(id: number): Promise<{ deleted: true; id: number }> {
    const track = await this.getTrack(id);
    await this.trackRepo.remove(track);
    return { deleted: true, id };
  }

  private async getArtistEntity(artistId: number): Promise<Artist> {
    const artist = await this.artistRepo.findOne({ where: { id: artistId } });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }
}

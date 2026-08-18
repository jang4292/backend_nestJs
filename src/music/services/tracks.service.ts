import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTrackDto } from '../dto/create-track.dto';
import { UpdateTrackDto } from '../dto/update-track.dto';
import { Track } from '../entities/track.entity';

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

  async getTrackList(): Promise<Track[]> {
    return this.trackRepo.find({ order: { id: 'DESC' } });
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

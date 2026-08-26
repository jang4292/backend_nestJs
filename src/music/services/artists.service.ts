import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateArtistDto } from '../dto/create-artist.dto';
import { UpdateArtistDto } from '../dto/update-artist.dto';
import { Artist } from '../entities/artist.entity';

@Injectable()
export class ArtistsService {
  constructor(
    @InjectRepository(Artist)
    private readonly artistRepo: Repository<Artist>,
  ) {}

  getArtistList(): Promise<Artist[]> {
    return this.artistRepo.find({ order: { name: 'ASC', id: 'ASC' } });
  }

  async getArtist(id: number): Promise<Artist> {
    const artist = await this.artistRepo.findOne({ where: { id } });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }

  async createArtist(dto: CreateArtistDto): Promise<Artist> {
    const duplicate = await this.artistRepo.findOne({
      where: { name: dto.name },
    });
    if (duplicate) {
      throw new ConflictException('Artist already exists');
    }

    const artist = this.artistRepo.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.artistRepo.save(artist);
  }

  async updateArtist(id: number, dto: UpdateArtistDto): Promise<Artist> {
    const artist = await this.getArtist(id);

    if (dto.name && dto.name !== artist.name) {
      const duplicate = await this.artistRepo.findOne({
        where: { name: dto.name },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Artist already exists');
      }
    }

    Object.assign(artist, {
      name: dto.name ?? artist.name,
      description:
        dto.description !== undefined
          ? (dto.description ?? null)
          : artist.description,
    });

    return this.artistRepo.save(artist);
  }

  async deleteArtist(id: number): Promise<{ deleted: true; id: number }> {
    const artist = await this.getArtist(id);

    try {
      await this.artistRepo.remove(artist);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Cannot delete artist because tracks are linked to this artist',
        );
      }
      throw error;
    }

    return { deleted: true, id };
  }

  private isForeignKeyViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: unknown } | undefined;
    return driverError?.code === '23503';
  }
}

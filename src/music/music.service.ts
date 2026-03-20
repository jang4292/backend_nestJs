// src/music/music.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Track } from './entities/track.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackToPlaylistDto } from './dto/add-track-to-playlist.dto';
import { UpdatePlaylistTrackDto } from './dto/update-playlist-track.dto';

@Injectable()
export class MusicService {
  constructor(
    @InjectRepository(Track)
    private readonly trackRepo: Repository<Track>,
    @InjectRepository(Playlist)
    private readonly playlistRepo: Repository<Playlist>,
    @InjectRepository(PlaylistTrack)
    private readonly playlistTrackRepo: Repository<PlaylistTrack>,
  ) {}

  // ========= Track =========

  async createTrack(dto: CreateTrackDto) {
    const track = this.trackRepo.create(dto);
    return this.trackRepo.save(track);
  }

  async getTrackList() {
    return this.trackRepo.find({ order: { id: 'DESC' } });
  }

  async getTrack(id: number) {
    const track = await this.trackRepo.findOne({ where: { id } });
    if (!track) throw new NotFoundException('Track not found');
    return track;
  }

  async updateTrack(id: number, dto: UpdateTrackDto) {
    const track = await this.getTrack(id);
    Object.assign(track, dto);
    return this.trackRepo.save(track);
  }

  async deleteTrack(id: number) {
    const track = await this.getTrack(id);
    await this.trackRepo.remove(track);
    return { deleted: true, id };
  }

  // ========= Playlist =========

  async createPlaylist(dto: CreatePlaylistDto) {
    const playlist = this.playlistRepo.create({
      name: dto.name,
      playDate: dto.playDate ?? null,
      description: dto.description ?? null,
    });
    return this.playlistRepo.save(playlist);
  }

  async getPlaylistList(playDate?: string) {
    // 날짜 필터가 있으면 해당 날짜만
    if (playDate) {
      return this.playlistRepo.find({
        where: { playDate },
        order: { playDate: 'DESC', id: 'DESC' },
      });
    }

    return this.playlistRepo.find({
      order: { playDate: 'DESC', id: 'DESC' },
    });
  }

  async getPlaylist(id: number) {
    const playlist = await this.playlistRepo.findOne({
      where: { id },
      relations: ['playlistTracks', 'playlistTracks.track'],
      // order: { playlistTracks: { seq: 'ASC' } as any },
      order: { playlistTracks: { seq: 'ASC' } },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async getPlaylistByDate(playDate: string) {
    const playlist = await this.playlistRepo.findOne({
      where: { playDate },
    });
    if (!playlist)
      throw new NotFoundException('Playlist not found for that date');
    return this.getPlaylist(playlist.id);
  }

  async updatePlaylist(id: number, dto: UpdatePlaylistDto) {
    const playlist = await this.playlistRepo.findOne({ where: { id } });
    if (!playlist) throw new NotFoundException('Playlist not found');

    Object.assign(playlist, {
      name: dto.name ?? playlist.name,
      playDate: dto.playDate ?? playlist.playDate,
      description: dto.description ?? playlist.description,
    });

    return this.playlistRepo.save(playlist);
  }

  async deletePlaylist(id: number) {
    const playlist = await this.playlistRepo.findOne({ where: { id } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    await this.playlistRepo.remove(playlist);
    return { deleted: true, id };
  }

  // ========= PlaylistTrack (playlist ↔ track 연결) =========

  async getTracksOfPlaylist(playlistId: number) {
    const playlist = await this.playlistRepo.findOne({
      where: { id: playlistId },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');

    const pts = await this.playlistTrackRepo.find({
      where: { playlist: { id: playlistId } },
      relations: ['track'],
      order: { seq: 'ASC' },
    });

    // 클라이언트에 필요한 형태로 정리
    return pts.map((pt) => ({
      playlistTrackId: pt.id,
      seq: pt.seq,
      note: pt.note,
      track: {
        id: pt.track.id,
        title: pt.track.title,
        artist: pt.track.artist,
        bpm: pt.track.bpm,
        lengthSec: pt.track.lengthSec,
      },
    }));
  }

  async addTrackToPlaylist(playlistId: number, dto: AddTrackToPlaylistDto) {
    const playlist = await this.playlistRepo.findOne({
      where: { id: playlistId },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');

    const track = await this.trackRepo.findOne({ where: { id: dto.trackId } });
    if (!track) throw new NotFoundException('Track not found');

    const pt = this.playlistTrackRepo.create({
      playlist,
      track,
      seq: dto.seq,
      note: dto.note ?? null,
    });
    return this.playlistTrackRepo.save(pt);
  }

  async updatePlaylistTrack(
    playlistId: number,
    playlistTrackId: number,
    dto: UpdatePlaylistTrackDto,
  ) {
    // playlistId도 같이 체크하면 안전
    const pt = await this.playlistTrackRepo.findOne({
      where: { id: playlistTrackId, playlist: { id: playlistId } },
    });
    if (!pt) throw new NotFoundException('PlaylistTrack not found');

    if (dto.seq !== undefined) pt.seq = dto.seq;
    if (dto.note !== undefined) pt.note = dto.note;

    return this.playlistTrackRepo.save(pt);
  }

  async removeTrackFromPlaylist(playlistId: number, playlistTrackId: number) {
    const pt = await this.playlistTrackRepo.findOne({
      where: { id: playlistTrackId, playlist: { id: playlistId } },
    });
    if (!pt) throw new NotFoundException('PlaylistTrack not found');
    await this.playlistTrackRepo.remove(pt);
    return { deleted: true, playlistTrackId };
  }
}

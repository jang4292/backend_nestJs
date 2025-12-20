// src/music/music.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { MusicService } from './music.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackToPlaylistDto } from './dto/add-track-to-playlist.dto';
import { UpdatePlaylistTrackDto } from './dto/update-playlist-track.dto';

@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  // ===== Track =====

  @Post('tracks')
  createTrack(@Body() dto: CreateTrackDto) {
    return this.musicService.createTrack(dto);
  }

  @Get('tracks')
  getTrackList() {
    return this.musicService.getTrackList();
  }

  @Get('tracks/:id')
  getTrack(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.getTrack(id);
  }

  @Patch('tracks/:id')
  updateTrack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackDto,
  ) {
    return this.musicService.updateTrack(id, dto);
  }

  // ===== Playlist =====

  // 생성
  @Post('playlists')
  createPlaylist(@Body() dto: CreatePlaylistDto) {
    return this.musicService.createPlaylist(dto);
  }

  // 리스트 (옵션: ?date=YYYY-MM-DD)
  @Get('playlists')
  getPlaylistList(@Query('date') date?: string) {
    return this.musicService.getPlaylistList(date);
  }

  // 단건 + 포함된 트랙 정보
  @Get('playlists/:id')
  getPlaylist(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.getPlaylist(id);
  }

  // 날짜 기준 플레이리스트 + 트랙
  @Get('playlists/by-date')
  getPlaylistByDate(@Query('date') date: string) {
    return this.musicService.getPlaylistByDate(date);
  }

  // 수정
  @Patch('playlists/:id')
  updatePlaylist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.musicService.updatePlaylist(id, dto);
  }

  // ===== PlaylistTrack (playlist와 track 관계 관리) =====

  // 해당 플레이리스트의 트랙 목록
  @Get('playlists/:playlistId/tracks')
  getTracksOfPlaylist(@Param('playlistId', ParseIntPipe) playlistId: number) {
    return this.musicService.getTracksOfPlaylist(playlistId);
  }

  // 플레이리스트에 트랙 추가
  @Post('playlists/:playlistId/tracks')
  addTrackToPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: AddTrackToPlaylistDto,
  ) {
    return this.musicService.addTrackToPlaylist(playlistId, dto);
  }

  // playlist_track 정보 수정 (seq, note 등)
  @Patch('playlists/:playlistId/tracks/:playlistTrackId')
  updatePlaylistTrack(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Param('playlistTrackId', ParseIntPipe) playlistTrackId: number,
    @Body() dto: UpdatePlaylistTrackDto,
  ) {
    return this.musicService.updatePlaylistTrack(
      playlistId,
      playlistTrackId,
      dto,
    );
  }
}

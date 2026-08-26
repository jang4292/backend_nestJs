// src/music/music.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MusicService } from './music.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { ListTracksQueryDto } from './dto/list-tracks-query.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackToPlaylistDto } from './dto/add-track-to-playlist.dto';
import { UpdatePlaylistTrackDto } from './dto/update-playlist-track.dto';

@ApiTags('music')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  // ===== Track =====

  @ApiOperation({ summary: '트랙 등록 (아티스트/제목/BPM)' })
  @Post('tracks')
  createTrack(@Body() dto: CreateTrackDto) {
    return this.musicService.createTrack(dto);
  }

  @ApiOperation({ summary: '트랙 목록 조회 (검색/필터/페이지네이션)' })
  @Get('tracks')
  getTrackList(@Query() query: ListTracksQueryDto) {
    return this.musicService.getTrackList(query);
  }

  @ApiOperation({ summary: '트랙 단건 조회' })
  @Get('tracks/:id')
  getTrack(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.getTrack(id);
  }

  @ApiOperation({ summary: '트랙 수정' })
  @Patch('tracks/:id')
  updateTrack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackDto,
  ) {
    return this.musicService.updateTrack(id, dto);
  }

  @ApiOperation({ summary: '트랙 삭제' })
  @Delete('tracks/:id')
  deleteTrack(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.deleteTrack(id);
  }

  // ===== Playlist =====

  // 생성
  @Post('playlists')
  createPlaylist(@Body() dto: CreatePlaylistDto) {
    return this.musicService.createPlaylist(dto);
  }

  // 날짜 기준 플레이리스트 + 트랙 (반드시 :id 라우트보다 먼저 선언)
  @Get('playlists/by-date')
  getPlaylistByDate(@Query('date') date: string) {
    return this.musicService.getPlaylistByDate(date);
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

  // 수정
  @Patch('playlists/:id')
  updatePlaylist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.musicService.updatePlaylist(id, dto);
  }

  // 삭제
  @Delete('playlists/:id')
  deletePlaylist(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.deletePlaylist(id);
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

  // 플레이리스트에서 트랙 제거
  @Delete('playlists/:playlistId/tracks/:playlistTrackId')
  removeTrackFromPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Param('playlistTrackId', ParseIntPipe) playlistTrackId: number,
  ) {
    return this.musicService.removeTrackFromPlaylist(
      playlistId,
      playlistTrackId,
    );
  }
}

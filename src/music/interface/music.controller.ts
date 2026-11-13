import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AdminOnly,
  Authenticated,
} from '../../auth/session/interface/auth-route.decorators';
import { ApiDefaultErrorResponse } from '../../common/http/api-contract.decorators';
import { MusicService } from '../music.service';
import type { Track } from '../entities/track.entity';
import { CreateArtistDto } from './dto/create-artist.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { ListTracksQueryDto } from './dto/list-tracks-query.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackToPlaylistDto } from './dto/add-track-to-playlist.dto';
import { UpdatePlaylistTrackDto } from './dto/update-playlist-track.dto';
import {
  LegacyArtistResponseDto,
  LegacyDeleteResponseDto,
  LegacyPlaylistResponseDto,
  LegacyPlaylistTrackDeleteResponseDto,
  LegacyPlaylistTrackResponseDto,
  LegacyPlaylistTrackSummaryResponseDto,
  LegacyTrackResponseDto,
} from './dto/music-legacy-response.dto';
import {
  FullTrackResponse,
  PaginatedFullTracks,
  PaginatedPublicTracks,
  PublicTrackResponse,
} from './presenters/track.presenter';

@ApiTags('music-legacy')
@Controller('music/legacy')
@ApiDefaultErrorResponse()
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  // ===== Artist =====

  @ApiOperation({ summary: '아티스트 목록 조회' })
  @ApiOkResponse({ type: LegacyArtistResponseDto, isArray: true })
  @Authenticated()
  @Get('artists')
  getArtistList(): Promise<LegacyArtistResponseDto[]> {
    return this.musicService.getArtistList();
  }

  @ApiOperation({ summary: '아티스트 단건 조회' })
  @ApiOkResponse({ type: LegacyArtistResponseDto })
  @Authenticated()
  @Get('artists/:id')
  getArtist(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LegacyArtistResponseDto> {
    return this.musicService.getArtist(id);
  }

  @ApiOperation({ summary: '아티스트 등록' })
  @ApiCreatedResponse({ type: LegacyArtistResponseDto })
  @AdminOnly()
  @Post('artists')
  createArtist(@Body() dto: CreateArtistDto): Promise<LegacyArtistResponseDto> {
    return this.musicService.createArtist(dto);
  }

  @ApiOperation({ summary: '아티스트 수정' })
  @ApiOkResponse({ type: LegacyArtistResponseDto })
  @AdminOnly()
  @Patch('artists/:id')
  updateArtist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArtistDto,
  ): Promise<LegacyArtistResponseDto> {
    return this.musicService.updateArtist(id, dto);
  }

  @ApiOperation({ summary: '아티스트 삭제' })
  @ApiOkResponse({ type: LegacyDeleteResponseDto })
  @AdminOnly()
  @Delete('artists/:id')
  deleteArtist(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LegacyDeleteResponseDto> {
    return this.musicService.deleteArtist(id);
  }

  // ===== Track =====

  @ApiOperation({ summary: '트랙 등록 (아티스트/제목/BPM)' })
  @ApiCreatedResponse({ type: LegacyTrackResponseDto })
  @AdminOnly()
  @Post('tracks')
  createTrack(@Body() dto: CreateTrackDto): Promise<LegacyTrackResponseDto> {
    return this.musicService.createTrack(dto);
  }

  @ApiOperation({ summary: '트랙 목록 조회 (검색/필터/페이지네이션)' })
  @ApiOkResponse({ type: PaginatedPublicTracks })
  @Get('tracks')
  async getTrackList(
    @Query() query: ListTracksQueryDto,
  ): Promise<PaginatedPublicTracks> {
    // 비로그인 공개 조회: 화면 표시와 검색에 필요한 안전한 필드만 반환합니다.
    // createdAt/updatedAt 같은 관리성 메타 정보는 로그인 전용 full API에서만 제공합니다.
    const tracks = await this.musicService.getTrackList(query);
    return {
      ...tracks,
      items: tracks.items.map(toPublicTrackResponse),
    };
  }

  @ApiOperation({ summary: '트랙 전체 목록 조회 (로그인 전용)' })
  @ApiOkResponse({ type: PaginatedFullTracks })
  @Authenticated()
  @Get('tracks/full')
  async getFullTrackList(
    @Query() query: ListTracksQueryDto,
  ): Promise<PaginatedFullTracks> {
    // 로그인 전체 조회: Track 엔티티가 가진 전체 응답 필드를 제공합니다.
    // 관리자/편집 화면처럼 생성일, 수정일이 필요한 곳에서 이 API를 사용합니다.
    const tracks = await this.musicService.getTrackList(query);
    return {
      ...tracks,
      items: tracks.items.map(toFullTrackResponse),
    };
  }

  @ApiOperation({ summary: '트랙 단건 조회' })
  @ApiOkResponse({ type: PublicTrackResponse })
  @Get('tracks/:id')
  async getTrack(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicTrackResponse> {
    // 비로그인 공개 조회: 단건도 목록과 같은 공개 필드만 노출합니다.
    return toPublicTrackResponse(await this.musicService.getTrack(id));
  }

  @ApiOperation({ summary: '트랙 전체 단건 조회 (로그인 전용)' })
  @ApiOkResponse({ type: FullTrackResponse })
  @Authenticated()
  @Get('tracks/:id/full')
  async getFullTrack(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FullTrackResponse> {
    // 로그인 전체 조회: Track 엔티티의 전체 응답 필드를 노출합니다.
    return toFullTrackResponse(await this.musicService.getTrack(id));
  }

  @ApiOperation({ summary: '트랙 수정' })
  @ApiOkResponse({ type: LegacyTrackResponseDto })
  @AdminOnly()
  @Patch('tracks/:id')
  updateTrack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackDto,
  ): Promise<LegacyTrackResponseDto> {
    return this.musicService.updateTrack(id, dto);
  }

  @ApiOperation({ summary: '트랙 삭제' })
  @ApiOkResponse({ type: LegacyDeleteResponseDto })
  @AdminOnly()
  @Delete('tracks/:id')
  deleteTrack(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LegacyDeleteResponseDto> {
    return this.musicService.deleteTrack(id);
  }

  // ===== Playlist =====

  // 생성
  @ApiOperation({ summary: '플레이리스트 등록 (Legacy)' })
  @ApiCreatedResponse({ type: LegacyPlaylistResponseDto })
  @AdminOnly()
  @Post('playlists')
  createPlaylist(
    @Body() dto: CreatePlaylistDto,
  ): Promise<LegacyPlaylistResponseDto> {
    return this.musicService.createPlaylist(dto);
  }

  // 날짜 기준 플레이리스트 + 트랙 (반드시 :id 라우트보다 먼저 선언)
  @ApiOperation({ summary: '날짜별 플레이리스트 조회 (Legacy)' })
  @ApiQuery({
    name: 'date',
    required: true,
    schema: { type: 'string', format: 'date' },
    description: '조회할 날짜 (YYYY-MM-DD)',
  })
  @ApiOkResponse({ type: LegacyPlaylistResponseDto })
  @Authenticated()
  @Get('playlists/by-date')
  getPlaylistByDate(
    @Query('date') date?: string,
  ): Promise<LegacyPlaylistResponseDto> {
    // date가 없으면 조건 없는 조회가 되어 임의의 playlist가 반환되므로 400으로 막습니다.
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date query must be YYYY-MM-DD');
    }
    return this.musicService.getPlaylistByDate(date);
  }

  // 리스트 (옵션: ?date=YYYY-MM-DD)
  @ApiOperation({ summary: '플레이리스트 목록 조회 (Legacy)' })
  @ApiQuery({
    name: 'date',
    required: false,
    schema: { type: 'string', format: 'date' },
    description: '선택적 날짜 필터 (YYYY-MM-DD)',
  })
  @ApiOkResponse({ type: LegacyPlaylistResponseDto, isArray: true })
  @Authenticated()
  @Get('playlists')
  getPlaylistList(
    @Query('date') date?: string,
  ): Promise<LegacyPlaylistResponseDto[]> {
    return this.musicService.getPlaylistList(date);
  }

  // 단건 + 포함된 트랙 정보
  @ApiOperation({ summary: '플레이리스트 단건 조회 (Legacy)' })
  @ApiOkResponse({ type: LegacyPlaylistResponseDto })
  @Authenticated()
  @Get('playlists/:id')
  getPlaylist(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LegacyPlaylistResponseDto> {
    return this.musicService.getPlaylist(id);
  }

  // 수정
  @ApiOperation({ summary: '플레이리스트 수정 (Legacy)' })
  @ApiOkResponse({ type: LegacyPlaylistResponseDto })
  @AdminOnly()
  @Patch('playlists/:id')
  updatePlaylist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlaylistDto,
  ): Promise<LegacyPlaylistResponseDto> {
    return this.musicService.updatePlaylist(id, dto);
  }

  // 삭제
  @ApiOperation({ summary: '플레이리스트 삭제 (Legacy)' })
  @ApiOkResponse({ type: LegacyDeleteResponseDto })
  @AdminOnly()
  @Delete('playlists/:id')
  deletePlaylist(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LegacyDeleteResponseDto> {
    return this.musicService.deletePlaylist(id);
  }

  // ===== PlaylistTrack (playlist와 track 관계 관리) =====

  // 해당 플레이리스트의 트랙 목록
  @ApiOperation({ summary: '플레이리스트 트랙 목록 조회 (Legacy)' })
  @ApiOkResponse({ type: LegacyPlaylistTrackSummaryResponseDto, isArray: true })
  @Authenticated()
  @Get('playlists/:playlistId/tracks')
  getTracksOfPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
  ): Promise<LegacyPlaylistTrackSummaryResponseDto[]> {
    return this.musicService.getTracksOfPlaylist(playlistId);
  }

  // 플레이리스트에 트랙 추가
  @ApiOperation({ summary: '플레이리스트에 트랙 추가 (Legacy)' })
  @ApiCreatedResponse({ type: LegacyPlaylistTrackResponseDto })
  @AdminOnly()
  @Post('playlists/:playlistId/tracks')
  addTrackToPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: AddTrackToPlaylistDto,
  ): Promise<LegacyPlaylistTrackResponseDto> {
    return this.musicService.addTrackToPlaylist(playlistId, dto);
  }

  // playlist_track 정보 수정 (seq, note 등)
  @ApiOperation({ summary: '플레이리스트 트랙 수정 (Legacy)' })
  @ApiOkResponse({ type: LegacyPlaylistTrackResponseDto })
  @AdminOnly()
  @Patch('playlists/:playlistId/tracks/:playlistTrackId')
  updatePlaylistTrack(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Param('playlistTrackId', ParseIntPipe) playlistTrackId: number,
    @Body() dto: UpdatePlaylistTrackDto,
  ): Promise<LegacyPlaylistTrackResponseDto> {
    return this.musicService.updatePlaylistTrack(
      playlistId,
      playlistTrackId,
      dto,
    );
  }

  // 플레이리스트에서 트랙 제거
  @ApiOperation({ summary: '플레이리스트에서 트랙 제거 (Legacy)' })
  @ApiOkResponse({ type: LegacyPlaylistTrackDeleteResponseDto })
  @AdminOnly()
  @Delete('playlists/:playlistId/tracks/:playlistTrackId')
  removeTrackFromPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Param('playlistTrackId', ParseIntPipe) playlistTrackId: number,
  ): Promise<LegacyPlaylistTrackDeleteResponseDto> {
    return this.musicService.removeTrackFromPlaylist(
      playlistId,
      playlistTrackId,
    );
  }
}

function toPublicTrackResponse(track: Track): PublicTrackResponse {
  return {
    id: track.id,
    title: track.title,
    artist: {
      id: track.artist.id,
      name: track.artist.name,
    },
    bpm: track.bpm,
    lengthSec: track.lengthSec,
  };
}

function toFullTrackResponse(track: Track): FullTrackResponse {
  return {
    ...toPublicTrackResponse(track),
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
  };
}

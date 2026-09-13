import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/session/interface/jwt-auth.guard';
import { CatalogMusicService } from '../catalog-music.service';
import { CreateAudioAssetDto } from './dto/create-audio-asset.dto';
import { CreateCatalogTrackDto } from './dto/create-catalog-track.dto';
import { UpdateAudioAssetDto } from './dto/update-audio-asset.dto';
import { UpdateCatalogTrackDto } from './dto/update-catalog-track.dto';
import { CreateCatalogPlaylistDto } from './dto/create-catalog-playlist.dto';
import { AddCatalogPlaylistTrackDto } from './dto/add-catalog-playlist-track.dto';
import { ListPublicPlaylistsQueryDto } from './dto/list-public-playlists-query.dto';
import { ReorderCatalogPlaylistDto } from './dto/reorder-catalog-playlist.dto';
import {
  PaginatedPublicPlaylistsResponse,
  toPublicPlaylistResponse,
} from './presenters/catalog-playlist.presenter';

@ApiTags('music')
@Controller('music')
export class CatalogMusicController {
  constructor(private readonly musicService: CatalogMusicService) {}

  @ApiOperation({ summary: '트랙 등록' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tracks')
  createTrack(@Body() dto: CreateCatalogTrackDto) {
    return this.musicService.createTrack(dto);
  }

  @ApiOperation({ summary: '트랙 목록 조회' })
  @Get('tracks')
  listTracks() {
    return this.musicService.listTracks();
  }

  @ApiOperation({ summary: '트랙 상세 조회' })
  @Get('tracks/:id')
  getTrack(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.getTrack(id).then((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
    }));
  }

  @ApiOperation({ summary: '트랙 수정' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('tracks/:id')
  updateTrack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatalogTrackDto,
  ) {
    return this.musicService.updateTrack(id, dto);
  }

  @ApiOperation({ summary: '트랙 삭제' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('tracks/:id')
  deleteTrack(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.deleteTrack(id);
  }

  @ApiOperation({ summary: '트랙 음원 파일 등록' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tracks/:trackId/audio-assets')
  createAudioAsset(
    @Param('trackId', ParseIntPipe) trackId: number,
    @Body() dto: CreateAudioAssetDto,
  ) {
    return this.musicService.createAudioAsset(trackId, dto);
  }

  @ApiOperation({ summary: '트랙 음원 파일 목록 조회' })
  // AudioAsset에는 저장된 음원 URL이 포함될 수 있으므로 인증된 관리 조회입니다.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('tracks/:trackId/audio-assets')
  listAudioAssets(@Param('trackId', ParseIntPipe) trackId: number) {
    return this.musicService.listAudioAssets(trackId);
  }

  @ApiOperation({ summary: '공개 Playlist 목록 조회' })
  // 공개 화면은 메타데이터만 읽습니다. 음원 접근과 URL 발급은 별도 정책입니다.
  @Get('public/playlists')
  async listPublicPlaylists(
    @Query() query: ListPublicPlaylistsQueryDto,
  ): Promise<PaginatedPublicPlaylistsResponse> {
    const result = await this.musicService.listPublicPlaylists(
      query.page,
      query.limit,
    );
    return {
      ...result,
      items: result.items.map((playlist) =>
        toPublicPlaylistResponse(playlist, false),
      ),
    };
  }

  @ApiOperation({ summary: '공개 Playlist 상세 및 Track 순서 조회' })
  @Get('public/playlists/:id')
  getPublicPlaylist(@Param('id', ParseIntPipe) id: number) {
    return this.musicService
      .getPublicPlaylist(id)
      .then((playlist) => toPublicPlaylistResponse(playlist));
  }

  @ApiOperation({ summary: 'Playlist 등록' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('playlists')
  createPlaylist(@Body() dto: CreateCatalogPlaylistDto) {
    return this.musicService.createPlaylist(dto);
  }

  @ApiOperation({ summary: 'Playlist 공개 전환' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('playlists/:id/publish')
  publishPlaylist(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.publishPlaylist(id);
  }

  @ApiOperation({ summary: 'Playlist에 Track 추가' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('playlists/:playlistId/tracks')
  addTrackToPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: AddCatalogPlaylistTrackDto,
  ) {
    return this.musicService.addTrackToPlaylist(playlistId, dto);
  }

  @ApiOperation({ summary: 'Playlist Track 순서 변경' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('playlists/:playlistId/tracks/reorder')
  reorderPlaylist(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: ReorderCatalogPlaylistDto,
  ) {
    return this.musicService.reorderPlaylist(playlistId, dto);
  }

  @ApiOperation({ summary: '음원 파일 수정' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('audio-assets/:id')
  updateAudioAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAudioAssetDto,
  ) {
    return this.musicService.updateAudioAsset(id, dto);
  }

  @ApiOperation({ summary: '음원 파일 삭제' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('audio-assets/:id')
  deleteAudioAsset(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.deleteAudioAsset(id);
  }
}

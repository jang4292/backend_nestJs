import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../../auth/session/interface/auth-route.decorators';
import { ApiDefaultErrorResponse } from '../../../common/http/api-contract.decorators';
import { MusicManagementService } from './music-management.service';
import {
  NameDto,
  PlaylistItemAssetDto,
  RecordingDto,
  StatisticsQueryDto,
  UsageDto,
  UsageItemDto,
  WorkDto,
} from './music-management.dto';

@ApiTags('music-management')
@ApiDefaultErrorResponse()
@Controller('music/management')
@AdminOnly()
export class MusicManagementController {
  constructor(private readonly service: MusicManagementService) {}
  @Post('artists')
  @ApiOperation({ summary: '정규 아티스트 등록' })
  createArtist(@Body() dto: NameDto) {
    return this.service.createArtist(dto);
  }
  @Get('artists')
  @ApiOperation({ summary: '이름 또는 별칭으로 아티스트 검색' })
  artists(@Query('q') query?: string) {
    return this.service.artists(query);
  }
  @Get('artists/:id/aliases') aliases(@Param('id', ParseIntPipe) id: number) {
    return this.service.aliases(id);
  }
  @Post('artists/:id/aliases') addAlias(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NameDto,
  ) {
    return this.service.addAlias(id, dto);
  }
  @Post('works') createWork(@Body() dto: WorkDto) {
    return this.service.createWork(dto);
  }
  @Get('works') works() {
    return this.service.works();
  }
  @Patch('recordings/:id') recording(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordingDto,
  ) {
    return this.service.updateRecording(id, dto);
  }
  @Get('playlists') playlists() {
    return this.service.playlists();
  }
  @Get('playlists/:id') playlist(@Param('id', ParseIntPipe) id: number) {
    return this.service.playlist(id);
  }
  @Patch('playlist-items/:id/asset') asset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PlaylistItemAssetDto,
  ) {
    return this.service.setPlaylistAsset(id, dto);
  }
  @Post('usages') createUsage(@Body() dto: UsageDto) {
    return this.service.createUsage(dto);
  }
  @Get('usages') usages() {
    return this.service.listUsages();
  }
  @Get('usages/:id') usage(@Param('id', ParseIntPipe) id: number) {
    return this.service.usage(id);
  }
  @Patch('usages/:id/items/:itemId') updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UsageItemDto,
  ) {
    return this.service.updateUsageItem(id, itemId, dto);
  }
  @Post('usages/:id/confirm') confirm(@Param('id', ParseIntPipe) id: number) {
    return this.service.confirmUsage(id);
  }
  @Get('statistics') statistics(@Query() query: StatisticsQueryDto) {
    return this.service.statistics(query);
  }
}

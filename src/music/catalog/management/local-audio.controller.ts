import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AdminOnly,
  Authenticated,
} from '../../../auth/session/interface/auth-route.decorators';
import { LocalAudioService, MAX_AUDIO_BYTES } from './local-audio.service';
import type { AudioUpload } from './local-audio.service';

@ApiTags('music-audio')
@Controller('music')
export class LocalAudioController {
  constructor(private readonly audio: LocalAudioService) {}

  @AdminOnly()
  @Post('tracks/:id/upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '음원 파일 업로드 (form field: file, 최대 50 MiB)' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
    }),
  )
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: AudioUpload,
  ) {
    return this.audio.upload(id, file);
  }

  @AdminOnly()
  @Get('management/audio-assets/:id/content')
  adminContent(
    @Param('id', ParseIntPipe) id: number,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    return this.audio.streamAdminAsset(id, range, response);
  }

  @Get('public/playlists/:playlistId/items/:itemId/content')
  publicContent(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    return this.audio.streamPlaylistItem(
      playlistId,
      itemId,
      true,
      range,
      response,
    );
  }

  @Authenticated()
  @ApiBearerAuth()
  @Get('playlists/:playlistId/items/:itemId/content')
  authenticatedContent(
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    return this.audio.streamPlaylistItem(
      playlistId,
      itemId,
      false,
      range,
      response,
    );
  }
}

// src/music/dto/update-playlist.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePlaylistDto } from './create-playlist.dto';

export class UpdatePlaylistDto extends PartialType(CreatePlaylistDto) {}

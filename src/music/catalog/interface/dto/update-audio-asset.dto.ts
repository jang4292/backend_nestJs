import { PartialType } from '@nestjs/mapped-types';
import { CreateAudioAssetDto } from './create-audio-asset.dto';

export class UpdateAudioAssetDto extends PartialType(CreateAudioAssetDto) {}

import { PartialType } from '@nestjs/swagger';
import { CreateAudioAssetDto } from './create-audio-asset.dto';

export class UpdateAudioAssetDto extends PartialType(CreateAudioAssetDto) {}

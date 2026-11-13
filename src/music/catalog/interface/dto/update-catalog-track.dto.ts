import { PartialType } from '@nestjs/swagger';
import { CreateCatalogTrackDto } from './create-catalog-track.dto';

export class UpdateCatalogTrackDto extends PartialType(CreateCatalogTrackDto) {}

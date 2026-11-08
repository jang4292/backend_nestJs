import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogTrackDto } from './create-catalog-track.dto';

export class UpdateCatalogTrackDto extends PartialType(CreateCatalogTrackDto) {}

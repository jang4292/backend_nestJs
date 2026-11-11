import { Type } from 'class-transformer';
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class ReorderCatalogPlaylistItemDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsInt()
  @Min(1)
  position!: number;
}

export class ReorderCatalogPlaylistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCatalogPlaylistItemDto)
  items!: ReorderCatalogPlaylistItemDto[];
}

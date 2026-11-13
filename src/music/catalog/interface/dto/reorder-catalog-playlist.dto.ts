import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class ReorderCatalogPlaylistItemDto {
  @ApiProperty({ type: 'integer', minimum: 1 })
  @IsInt()
  @Min(1)
  id!: number;

  @ApiProperty({ type: 'integer', minimum: 1 })
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

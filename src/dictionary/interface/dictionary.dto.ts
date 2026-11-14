import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DictionaryRevisionStatus } from '../entities/dictionary.entities';

export const SUPPORTED_DICTIONARY_LANGUAGES = [
  'en',
  'ko',
  'ja',
  'zh-Hans',
  'zh-Hant',
] as const;

const provided = (_object: object, value: unknown): boolean =>
  value !== undefined;

export class CreateDictionarySourceDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(200)
  name: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(200)
  license: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  attribution: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @ValidateIf(provided)
  @IsString()
  @MaxLength(1000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;
}

export class CreateDictionaryConceptDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  description: string;
}

export class DictionaryFormDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(200)
  text: string;

  @ApiPropertyOptional({ example: 'Hang', maxLength: 8 })
  @ValidateIf(provided)
  @IsString()
  @Matches(/^[A-Za-z]{4}$/u)
  script?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @ValidateIf(provided)
  @IsString()
  @Matches(/\S/u)
  @MaxLength(40)
  type?: string;
}

export class DictionarySenseDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  definition: string;

  @ApiPropertyOptional({ type: [Number], maxItems: 20 })
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  conceptIds?: number[];
}

export class CreateDictionaryLexemeDto {
  @ApiProperty({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  @IsIn(SUPPORTED_DICTIONARY_LANGUAGES)
  languageTag: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(200)
  lemma: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sourceId: number;

  @ApiPropertyOptional({ maxLength: 40 })
  @ValidateIf(provided)
  @IsString()
  @Matches(/\S/u)
  @MaxLength(40)
  partOfSpeech?: string;

  @ApiPropertyOptional({ type: [DictionaryFormDto], maxItems: 20 })
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DictionaryFormDto)
  forms?: DictionaryFormDto[];

  @ApiProperty({ type: [DictionarySenseDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DictionarySenseDto)
  senses: DictionarySenseDto[];
}

export class UpdateDictionaryLexemeDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @ValidateIf(provided)
  @IsString()
  @Matches(/\S/u)
  @MaxLength(200)
  lemma?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @ValidateIf(provided)
  @IsInt()
  @Min(1)
  sourceId?: number;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @Matches(/\S/u)
  @MaxLength(40)
  partOfSpeech?: string | null;

  @ApiPropertyOptional({ type: [DictionaryFormDto], maxItems: 20 })
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DictionaryFormDto)
  forms?: DictionaryFormDto[];

  @ApiPropertyOptional({
    type: [DictionarySenseDto],
    minItems: 1,
    maxItems: 20,
  })
  @ValidateIf(provided)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DictionarySenseDto)
  senses?: DictionarySenseDto[];
}

export class SubmitDictionaryRevisionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class ApproveDictionaryRevisionDto extends SubmitDictionaryRevisionDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  reason: string;
}

export class CreateDictionaryPublicationDto {
  @ApiProperty({ type: [Number], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  revisionIds: number[];

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsInt()
  @Min(1)
  expectedCurrentPublicationId?: number | null;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  reason: string;
}

export class DictionaryPageDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100000, default: 1 })
  @ValidateIf(provided)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @ValidateIf(provided)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListDictionaryLexemesDto extends DictionaryPageDto {
  @ApiPropertyOptional({ enum: DictionaryRevisionStatus })
  @ValidateIf(provided)
  @IsIn(Object.values(DictionaryRevisionStatus))
  status?: DictionaryRevisionStatus;
}

export class DictionaryCursorDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @ValidateIf(provided)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ maxLength: 256 })
  @ValidateIf(provided)
  @IsString()
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9_-]+$/u)
  cursor?: string;
}

export class SearchDictionaryDto extends DictionaryCursorDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf(provided)
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  @ValidateIf(provided)
  @IsIn(SUPPORTED_DICTIONARY_LANGUAGES)
  language?: string;
}

export class DictionaryConceptQueryDto extends DictionaryCursorDto {
  @ApiPropertyOptional({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  @ValidateIf(provided)
  @IsIn(SUPPORTED_DICTIONARY_LANGUAGES)
  language?: string;
}

export class DictionaryTranslationsQueryDto extends DictionaryCursorDto {
  @ApiPropertyOptional({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  @ValidateIf(provided)
  @IsIn(SUPPORTED_DICTIONARY_LANGUAGES)
  targetLanguage?: string;
}

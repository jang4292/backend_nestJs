import { ApiProperty } from '@nestjs/swagger';
import { DictionaryRevisionStatus } from '../entities/dictionary.entities';
import { SUPPORTED_DICTIONARY_LANGUAGES } from './dictionary.dto';

class DictionaryEnvelopeDto {
  @ApiProperty({ enum: [true] })
  ok!: true;

  @ApiProperty()
  requestId!: string;
}

class DictionaryPageMetaDto {
  @ApiProperty({ type: 'integer', minimum: 0 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  limit!: number;
}

export class DictionaryLanguageDto {
  @ApiProperty({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  script!: string;
}

export class DictionarySourceAttributionDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  license!: string;

  @ApiProperty()
  attribution!: string;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

export class DictionarySourceDto extends DictionarySourceAttributionDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class DictionaryConceptDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class DictionaryFormViewDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  text!: string;

  @ApiProperty({ type: String, nullable: true })
  script!: string | null;

  @ApiProperty({ type: String, nullable: true })
  type!: string | null;
}

export class DictionarySenseViewDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ type: 'integer' })
  position!: number;

  @ApiProperty()
  definition!: string;

  @ApiProperty({ type: [Number] })
  conceptIds!: number[];
}

export class DictionaryRevisionViewDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ type: 'integer' })
  version!: number;

  @ApiProperty({ enum: DictionaryRevisionStatus })
  status!: DictionaryRevisionStatus;

  @ApiProperty()
  lemma!: string;

  @ApiProperty({ type: String, nullable: true })
  partOfSpeech!: string | null;

  @ApiProperty({ type: 'integer' })
  sourceId!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  createdBy!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  submittedAt!: string | null;

  @ApiProperty({ type: 'integer', nullable: true })
  approvedBy!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  approvedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [DictionaryFormViewDto] })
  forms!: DictionaryFormViewDto[];

  @ApiProperty({ type: [DictionarySenseViewDto] })
  senses!: DictionarySenseViewDto[];
}

export class DictionaryAdminLexemeDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  languageTag!: string;

  @ApiProperty({ type: 'integer' })
  currentVersion!: number;

  @ApiProperty({ type: DictionaryRevisionViewDto })
  revision!: DictionaryRevisionViewDto;
}

export class DictionaryAdminLexemeSummaryDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  languageTag!: string;

  @ApiProperty({ type: 'integer' })
  currentVersion!: number;

  @ApiProperty({ type: 'integer' })
  revisionId!: number;

  @ApiProperty({ enum: DictionaryRevisionStatus })
  status!: DictionaryRevisionStatus;

  @ApiProperty()
  lemma!: string;
}

export class DictionaryPublicLexemeDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ enum: SUPPORTED_DICTIONARY_LANGUAGES })
  languageTag!: string;

  @ApiProperty()
  lemma!: string;

  @ApiProperty({ type: String, nullable: true })
  partOfSpeech!: string | null;

  @ApiProperty({ type: 'integer' })
  contentRevisionId!: number;

  @ApiProperty({ type: [DictionaryFormViewDto] })
  forms!: DictionaryFormViewDto[];

  @ApiProperty({ type: [DictionarySenseViewDto] })
  senses!: DictionarySenseViewDto[];

  @ApiProperty({ type: DictionarySourceAttributionDto })
  source!: DictionarySourceAttributionDto;
}

export class DictionaryPublicLexemeDetailDto extends DictionaryPublicLexemeDto {
  @ApiProperty({ type: 'integer' })
  publicationId!: number;
}

export class DictionarySearchDataDto {
  @ApiProperty({ type: 'integer', nullable: true })
  publicationId!: number | null;

  @ApiProperty({ type: [DictionaryPublicLexemeDto] })
  items!: DictionaryPublicLexemeDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class DictionaryPublishedConceptDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  description!: string;
}

export class DictionaryConceptSearchDataDto extends DictionarySearchDataDto {
  @ApiProperty({ type: DictionaryPublishedConceptDto })
  concept!: DictionaryPublishedConceptDto;
}

export class DictionarySourcePageDto extends DictionaryPageMetaDto {
  @ApiProperty({ type: [DictionarySourceDto] })
  items!: DictionarySourceDto[];
}

export class DictionaryConceptPageDto extends DictionaryPageMetaDto {
  @ApiProperty({ type: [DictionaryConceptDto] })
  items!: DictionaryConceptDto[];
}

export class DictionaryAdminLexemePageDto extends DictionaryPageMetaDto {
  @ApiProperty({ type: [DictionaryAdminLexemeSummaryDto] })
  items!: DictionaryAdminLexemeSummaryDto[];
}

export class DictionaryAuditLogDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  actorId!: number | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ type: 'integer' })
  entityId!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  revisionId!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  previousRevisionId!: number | null;

  @ApiProperty()
  requestId!: string;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class DictionaryAuditPageDto extends DictionaryPageMetaDto {
  @ApiProperty({ type: [DictionaryAuditLogDto] })
  items!: DictionaryAuditLogDto[];
}

export class DictionaryPublicationDto {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  previousPublicationId!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [Number] })
  revisionIds!: number[];
}

export class DictionaryPublicationStateDto {
  @ApiProperty({ type: 'integer', nullable: true })
  publicationId!: number | null;
}

export class DictionaryHealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}

export class DictionaryLanguagesResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: [DictionaryLanguageDto] })
  data!: DictionaryLanguageDto[];
}

export class DictionarySourceResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionarySourceDto })
  data!: DictionarySourceDto;
}

export class DictionarySourcePageResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionarySourcePageDto })
  data!: DictionarySourcePageDto;
}

export class DictionaryConceptResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryConceptDto })
  data!: DictionaryConceptDto;
}

export class DictionaryConceptPageResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryConceptPageDto })
  data!: DictionaryConceptPageDto;
}

export class DictionaryAdminLexemeResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryAdminLexemeDto })
  data!: DictionaryAdminLexemeDto;
}

export class DictionaryAdminLexemePageResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryAdminLexemePageDto })
  data!: DictionaryAdminLexemePageDto;
}

export class DictionarySearchResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionarySearchDataDto })
  data!: DictionarySearchDataDto;
}

export class DictionaryPublicLexemeResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryPublicLexemeDetailDto })
  data!: DictionaryPublicLexemeDetailDto;
}

export class DictionaryConceptSearchResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryConceptSearchDataDto })
  data!: DictionaryConceptSearchDataDto;
}

export class DictionaryPublicationResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryPublicationDto })
  data!: DictionaryPublicationDto;
}

export class DictionaryPublicationStateResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryPublicationStateDto })
  data!: DictionaryPublicationStateDto;
}

export class DictionaryAuditPageResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryAuditPageDto })
  data!: DictionaryAuditPageDto;
}

export class DictionaryHealthResponseDto extends DictionaryEnvelopeDto {
  @ApiProperty({ type: DictionaryHealthDto })
  data!: DictionaryHealthDto;
}

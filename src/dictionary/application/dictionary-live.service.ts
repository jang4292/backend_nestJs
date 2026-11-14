import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { escapeLike } from '../../common/database/escape-like';
import {
  DictionaryConcept,
  DictionaryLanguage,
  DictionaryPublicationEntry,
  DictionaryPublicationState,
  DictionarySense,
  DictionarySenseConcept,
} from '../entities/dictionary.entities';
import {
  DictionaryConceptQueryDto,
  DictionaryTranslationsQueryDto,
  SearchDictionaryDto,
} from '../interface/dictionary.dto';
import {
  loadRevisionContent,
  normalizeDictionaryText,
} from './dictionary-content';

interface SearchOptions {
  q?: string;
  language?: string;
  conceptId?: number;
  limit: number;
  cursor?: string;
}

interface CursorPayload {
  publicationId: number;
  lastId: number;
  scope: string;
}

@Injectable()
export class DictionaryLiveService {
  constructor(private readonly dataSource: DataSource) {}

  async listLanguages() {
    const languages = await this.dataSource
      .getRepository(DictionaryLanguage)
      .find({ order: { sortOrder: 'ASC' } });
    return languages.map((language) => ({
      code: language.code,
      name: language.name,
      script: language.script,
    }));
  }

  async search(query: SearchDictionaryDto) {
    const publicationId = await this.currentPublicationId();
    return this.searchPublication(publicationId, {
      q: query.q,
      language: query.language,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  async getLexeme(id: number) {
    const publicationId = await this.currentPublicationId();
    if (publicationId === null) {
      throw new NotFoundException('Published lexeme not found');
    }
    const entry = await this.dataSource
      .getRepository(DictionaryPublicationEntry)
      .findOne({
        where: { publicationId, lexemeId: id },
        relations: { revision: { lexeme: true, source: true } },
      });
    if (!entry) throw new NotFoundException('Published lexeme not found');
    const [item] = await this.presentEntries([entry]);
    return { ...item, publicationId };
  }

  concept(id: number, query: DictionaryConceptQueryDto) {
    return this.findConcept(id, {
      language: query.language,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  translations(id: number, query: DictionaryTranslationsQueryDto) {
    return this.findConcept(id, {
      language: query.targetLanguage,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  private async findConcept(
    id: number,
    options: Omit<SearchOptions, 'conceptId' | 'q'>,
  ) {
    const publicationId = await this.currentPublicationId();
    if (publicationId === null) {
      throw new NotFoundException('Published concept not found');
    }
    const concept = await this.dataSource
      .getRepository(DictionaryConcept)
      .findOneBy({ id });
    if (!concept) throw new NotFoundException('Published concept not found');

    const visible = await this.dataSource
      .getRepository(DictionaryPublicationEntry)
      .createQueryBuilder('entry')
      .innerJoin('entry.revision', 'revision')
      .innerJoin(DictionarySense, 'sense', 'sense.revisionId = revision.id')
      .innerJoin(
        DictionarySenseConcept,
        'link',
        'link.senseId = sense.id AND link.conceptId = :conceptId',
        { conceptId: id },
      )
      .where('entry.publicationId = :publicationId', { publicationId })
      .getExists();
    if (!visible) throw new NotFoundException('Published concept not found');

    const result = await this.searchPublication(publicationId, {
      ...options,
      conceptId: id,
    });
    return {
      ...result,
      concept: { id: concept.id, description: concept.description },
    };
  }

  private async searchPublication(
    publicationId: number | null,
    options: SearchOptions,
  ) {
    const normalizedQuery =
      options.q === undefined ? undefined : normalizeDictionaryText(options.q);
    const scope = cursorScope({
      q: normalizedQuery ?? null,
      language: options.language ?? null,
      conceptId: options.conceptId ?? null,
    });
    let lastId = 0;
    if (options.cursor) {
      const cursor = decodeCursor(options.cursor);
      if (cursor.scope !== scope) {
        throw new BadRequestException('Cursor does not match the query');
      }
      if (cursor.publicationId !== publicationId) {
        throw new ConflictException('Publication changed; restart pagination');
      }
      lastId = cursor.lastId;
    }
    if (publicationId === null) {
      return { publicationId: null, items: [], nextCursor: null };
    }

    const builder = this.dataSource
      .getRepository(DictionaryPublicationEntry)
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.revision', 'revision')
      .innerJoinAndSelect('revision.lexeme', 'lexeme')
      .innerJoinAndSelect('revision.source', 'source')
      .where('entry.publicationId = :publicationId', { publicationId })
      .andWhere('entry.lexemeId > :lastId', { lastId });
    if (options.language) {
      builder.andWhere('lexeme.languageTag = :language', {
        language: options.language,
      });
    }
    if (normalizedQuery !== undefined) {
      builder.andWhere(
        `(revision.normalizedLemma LIKE :pattern ESCAPE '!'
          OR EXISTS (
            SELECT 1 FROM \`dictionary_forms\` form
            WHERE form.revisionId = revision.id
              AND form.normalizedText LIKE :pattern ESCAPE '!'
          ))`,
        { pattern: `${escapeLike(normalizedQuery, '!')}%` },
      );
    }
    if (options.conceptId !== undefined) {
      builder.andWhere(
        `EXISTS (
          SELECT 1 FROM \`dictionary_senses\` sense
          INNER JOIN \`dictionary_sense_concepts\` link ON link.senseId = sense.id
          WHERE sense.revisionId = revision.id AND link.conceptId = :conceptId
        )`,
        { conceptId: options.conceptId },
      );
    }
    const entries = await builder
      .orderBy('entry.lexemeId', 'ASC')
      .limit(options.limit + 1)
      .getMany();
    const hasNext = entries.length > options.limit;
    const page = entries.slice(0, options.limit);
    const items = await this.presentEntries(page);
    const nextCursor =
      hasNext && page.length > 0
        ? encodeCursor({
            publicationId,
            lastId: page[page.length - 1].lexemeId,
            scope,
          })
        : null;
    return { publicationId, items, nextCursor };
  }

  private async presentEntries(entries: DictionaryPublicationEntry[]) {
    const content = await loadRevisionContent(
      this.dataSource.manager,
      entries.map((entry) => entry.revisionId),
    );
    return entries.map((entry) => {
      const revision = entry.revision;
      const details = content.get(entry.revisionId);
      if (!revision?.lexeme || !revision.source || !details) {
        throw new Error('Published dictionary revision is incomplete');
      }
      return {
        id: entry.lexemeId,
        languageTag: revision.lexeme.languageTag,
        lemma: revision.lemma,
        partOfSpeech: revision.partOfSpeech,
        contentRevisionId: revision.id,
        forms: details.forms,
        senses: details.senses,
        source: {
          id: revision.source.id,
          name: revision.source.name,
          license: revision.source.license,
          attribution: revision.source.attribution,
          url: revision.source.url,
        },
      };
    });
  }

  private async currentPublicationId(): Promise<number | null> {
    const state = await this.dataSource
      .getRepository(DictionaryPublicationState)
      .findOneBy({ id: 1 });
    if (!state) throw new Error('Dictionary publication state is missing');
    return state.currentPublicationId;
  }
}

function cursorScope(filters: {
  q: string | null;
  language: string | null;
  conceptId: number | null;
}): string {
  return createHash('sha256')
    .update(JSON.stringify(filters))
    .digest('base64url')
    .slice(0, 16);
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  if (Buffer.from(decoded, 'utf8').toString('base64url') !== cursor) {
    throw new BadRequestException('Invalid cursor');
  }
  let value: unknown;
  try {
    value = JSON.parse(decoded);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new BadRequestException('Invalid cursor');
    }
    throw error;
  }
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException('Invalid cursor');
  }
  const fields = value as Record<string, unknown>;
  if (
    typeof fields.publicationId !== 'number' ||
    !Number.isSafeInteger(fields.publicationId) ||
    fields.publicationId < 1 ||
    typeof fields.lastId !== 'number' ||
    !Number.isSafeInteger(fields.lastId) ||
    fields.lastId < 1 ||
    typeof fields.scope !== 'string' ||
    !/^[A-Za-z0-9_-]{16}$/u.test(fields.scope)
  ) {
    throw new BadRequestException('Invalid cursor');
  }
  return {
    publicationId: fields.publicationId,
    lastId: fields.lastId,
    scope: fields.scope,
  };
}

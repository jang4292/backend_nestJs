import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  DictionaryAuditLog,
  DictionaryConcept,
  DictionaryForm,
  DictionaryLanguage,
  DictionaryLexeme,
  DictionaryPublication,
  DictionaryPublicationEntry,
  DictionaryPublicationState,
  DictionaryRevision,
  DictionaryRevisionStatus,
  DictionarySense,
  DictionarySenseConcept,
  DictionarySource,
} from '../entities/dictionary.entities';
import {
  ApproveDictionaryRevisionDto,
  CreateDictionaryConceptDto,
  CreateDictionaryLexemeDto,
  CreateDictionaryPublicationDto,
  CreateDictionarySourceDto,
  DictionaryPageDto,
  ListDictionaryLexemesDto,
  SubmitDictionaryRevisionDto,
  UpdateDictionaryLexemeDto,
} from '../interface/dictionary.dto';
import {
  assertWellFormedText,
  loadRevisionContent,
  normalizeDictionaryText,
  presentAdminLexeme,
} from './dictionary-content';

export interface DictionaryActor {
  actorId: number;
  requestId: string;
}

interface RevisionInput {
  lemma: string;
  partOfSpeech: string | null;
  sourceId: number;
  forms: { text: string; script?: string | null; type?: string | null }[];
  senses: { definition: string; conceptIds?: number[] }[];
}

interface AuditInput {
  action: string;
  entityType: string;
  entityId: number;
  revisionId?: number;
  previousRevisionId?: number;
  reason?: string;
}

@Injectable()
export class DictionaryAdminService {
  constructor(private readonly dataSource: DataSource) {}

  createSource(dto: CreateDictionarySourceDto, actor: DictionaryActor) {
    for (const value of [dto.name, dto.license, dto.attribution, dto.url]) {
      if (value !== undefined) assertWellFormedText(value);
    }
    return this.dataSource.transaction(async (manager) => {
      const source = await manager.save(DictionarySource, {
        name: dto.name,
        license: dto.license,
        attribution: dto.attribution,
        url: dto.url ?? null,
      });
      await this.audit(manager, actor, {
        action: 'source.create',
        entityType: 'source',
        entityId: source.id,
      });
      return this.presentSource(source);
    });
  }

  async listSources(query: DictionaryPageDto) {
    const [sources, total] = await this.dataSource
      .getRepository(DictionarySource)
      .findAndCount({
        order: { id: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
    return {
      items: sources.map((source) => this.presentSource(source)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  createConcept(dto: CreateDictionaryConceptDto, actor: DictionaryActor) {
    assertWellFormedText(dto.description);
    return this.dataSource.transaction(async (manager) => {
      const concept = await manager.save(DictionaryConcept, {
        description: dto.description,
      });
      await this.audit(manager, actor, {
        action: 'concept.create',
        entityType: 'concept',
        entityId: concept.id,
      });
      return {
        id: concept.id,
        description: concept.description,
        createdAt: concept.createdAt,
      };
    });
  }

  async listConcepts(query: DictionaryPageDto) {
    const [concepts, total] = await this.dataSource
      .getRepository(DictionaryConcept)
      .findAndCount({
        order: { id: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
    return {
      items: concepts.map((concept) => ({
        id: concept.id,
        description: concept.description,
        createdAt: concept.createdAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  createLexeme(dto: CreateDictionaryLexemeDto, actor: DictionaryActor) {
    return this.dataSource.transaction(async (manager) => {
      const language = await manager.findOneBy(DictionaryLanguage, {
        code: dto.languageTag,
      });
      if (!language) {
        throw new BadRequestException('Unsupported dictionary language');
      }
      const input: RevisionInput = {
        lemma: dto.lemma,
        partOfSpeech: dto.partOfSpeech ?? null,
        sourceId: dto.sourceId,
        forms: dto.forms ?? [],
        senses: dto.senses,
      };
      await this.validateRevisionInput(manager, input);
      const lexeme = await manager.save(DictionaryLexeme, {
        languageTag: dto.languageTag,
        currentVersion: 1,
      });
      const revision = await this.createRevision(manager, lexeme, input, actor);
      await this.audit(manager, actor, {
        action: 'lexeme.create',
        entityType: 'lexeme',
        entityId: lexeme.id,
        revisionId: revision.id,
      });
      return presentAdminLexeme(manager, lexeme, revision);
    });
  }

  async listLexemes(query: ListDictionaryLexemesDto) {
    const builder = this.dataSource
      .getRepository(DictionaryLexeme)
      .createQueryBuilder('lexeme')
      .innerJoin(
        DictionaryRevision,
        'revision',
        'revision.lexemeId = lexeme.id AND revision.version = lexeme.currentVersion',
      );
    if (query.status) {
      builder.andWhere('revision.status = :status', { status: query.status });
    }
    const total = await builder.clone().getCount();
    const items = await builder
      .select('lexeme.id', 'id')
      .addSelect('lexeme.languageTag', 'languageTag')
      .addSelect('lexeme.currentVersion', 'currentVersion')
      .addSelect('revision.id', 'revisionId')
      .addSelect('revision.status', 'status')
      .addSelect('revision.lemma', 'lemma')
      .orderBy('lexeme.id', 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<{
        id: number;
        languageTag: string;
        currentVersion: number;
        revisionId: number;
        status: DictionaryRevisionStatus;
        lemma: string;
      }>();
    return { items, total, page: query.page, limit: query.limit };
  }

  async getLexeme(id: number) {
    const manager = this.dataSource.manager;
    const lexeme = await manager.findOneBy(DictionaryLexeme, { id });
    if (!lexeme) throw new NotFoundException('Dictionary lexeme not found');
    const revision = await this.currentRevision(manager, lexeme);
    return presentAdminLexeme(manager, lexeme, revision);
  }

  updateLexeme(
    id: number,
    dto: UpdateDictionaryLexemeDto,
    actor: DictionaryActor,
  ) {
    if (
      dto.lemma === undefined &&
      dto.sourceId === undefined &&
      dto.partOfSpeech === undefined &&
      dto.forms === undefined &&
      dto.senses === undefined
    ) {
      throw new BadRequestException('At least one content field is required');
    }
    return this.dataSource.transaction(async (manager) => {
      const lexeme = await this.lockLexeme(manager, id, dto.expectedVersion);
      const previous = await this.currentRevision(manager, lexeme);
      const previousContent = (
        await loadRevisionContent(manager, [previous.id])
      ).get(previous.id);
      if (!previousContent) {
        throw new Error('Dictionary revision content could not be loaded');
      }
      const input: RevisionInput = {
        lemma: dto.lemma ?? previous.lemma,
        sourceId: dto.sourceId ?? previous.sourceId,
        partOfSpeech:
          dto.partOfSpeech === undefined
            ? previous.partOfSpeech
            : dto.partOfSpeech,
        forms: dto.forms ?? previousContent.forms,
        senses: dto.senses ?? previousContent.senses,
      };
      await this.validateRevisionInput(manager, input);
      lexeme.currentVersion += 1;
      await manager.save(DictionaryLexeme, lexeme);
      const revision = await this.createRevision(manager, lexeme, input, actor);
      await this.audit(manager, actor, {
        action: 'lexeme.revise',
        entityType: 'lexeme',
        entityId: lexeme.id,
        revisionId: revision.id,
        previousRevisionId: previous.id,
      });
      return presentAdminLexeme(manager, lexeme, revision);
    });
  }

  submitRevision(
    id: number,
    dto: SubmitDictionaryRevisionDto,
    actor: DictionaryActor,
  ) {
    return this.transitionRevision(
      id,
      dto.expectedVersion,
      DictionaryRevisionStatus.DRAFT,
      DictionaryRevisionStatus.IN_REVIEW,
      actor,
    );
  }

  approveRevision(
    id: number,
    dto: ApproveDictionaryRevisionDto,
    actor: DictionaryActor,
  ) {
    assertWellFormedText(dto.reason);
    return this.transitionRevision(
      id,
      dto.expectedVersion,
      DictionaryRevisionStatus.IN_REVIEW,
      DictionaryRevisionStatus.APPROVED,
      actor,
      dto.reason,
    );
  }

  async currentPublication() {
    const state = await this.publicationState(this.dataSource.manager);
    return { publicationId: state.currentPublicationId };
  }

  publish(dto: CreateDictionaryPublicationDto, actor: DictionaryActor) {
    assertWellFormedText(dto.reason);
    return this.dataSource.transaction(async (manager) => {
      const state = await this.publicationState(manager, true);
      if (
        state.currentPublicationId !==
        (dto.expectedCurrentPublicationId ?? null)
      ) {
        throw new ConflictException('Current publication has changed');
      }
      const revisions = await manager.find(DictionaryRevision, {
        where: { id: In(dto.revisionIds) },
      });
      if (revisions.length !== dto.revisionIds.length) {
        throw new BadRequestException('One or more revisions do not exist');
      }
      if (
        revisions.some(
          (revision) => revision.status !== DictionaryRevisionStatus.APPROVED,
        )
      ) {
        throw new ConflictException('Only approved revisions can be published');
      }
      const lexemeIds = revisions.map((revision) => revision.lexemeId);
      if (new Set(lexemeIds).size !== lexemeIds.length) {
        throw new BadRequestException(
          'A publication can include only one revision per lexeme',
        );
      }

      const previousPublicationId = state.currentPublicationId;
      if (previousPublicationId !== null) {
        const existing = await manager.find(DictionaryPublicationEntry, {
          where: {
            publicationId: previousPublicationId,
            lexemeId: In(lexemeIds),
          },
          relations: { revision: true },
        });
        const newVersions = new Map(
          revisions.map((revision) => [revision.lexemeId, revision.version]),
        );
        if (
          existing.some(
            (entry) =>
              (newVersions.get(entry.lexemeId) ?? 0) <= entry.revision.version,
          )
        ) {
          throw new ConflictException(
            'A newer or identical revision is already published',
          );
        }
      }

      const publication = await manager.save(DictionaryPublication, {
        previousPublicationId,
        createdBy: actor.actorId,
        reason: dto.reason,
      });
      if (previousPublicationId !== null) {
        const placeholders = lexemeIds.map(() => '?').join(', ');
        await manager.query(
          `INSERT INTO \`dictionary_publication_entries\` (\`publicationId\`, \`lexemeId\`, \`revisionId\`)
           SELECT ?, \`lexemeId\`, \`revisionId\` FROM \`dictionary_publication_entries\`
           WHERE \`publicationId\` = ? AND \`lexemeId\` NOT IN (${placeholders})`,
          [publication.id, previousPublicationId, ...lexemeIds],
        );
      }
      await manager.insert(
        DictionaryPublicationEntry,
        revisions.map((revision) => ({
          publicationId: publication.id,
          lexemeId: revision.lexemeId,
          revisionId: revision.id,
        })),
      );
      state.currentPublicationId = publication.id;
      await manager.save(DictionaryPublicationState, state);
      await this.audit(manager, actor, {
        action: 'publication.create',
        entityType: 'publication',
        entityId: publication.id,
        reason: dto.reason,
      });
      return {
        id: publication.id,
        previousPublicationId,
        createdAt: publication.createdAt,
        revisionIds: revisions.map((revision) => revision.id),
      };
    });
  }

  async listAuditLogs(query: DictionaryPageDto) {
    const [logs, total] = await this.dataSource
      .getRepository(DictionaryAuditLog)
      .findAndCount({
        order: { id: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
    return {
      items: logs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        revisionId: log.revisionId,
        previousRevisionId: log.previousRevisionId,
        requestId: log.requestId,
        reason: log.reason,
        createdAt: log.createdAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private async transitionRevision(
    id: number,
    expectedVersion: number,
    from: DictionaryRevisionStatus,
    to: DictionaryRevisionStatus,
    actor: DictionaryActor,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const lexeme = await this.lockLexeme(manager, id, expectedVersion);
      const revision = await this.currentRevision(manager, lexeme);
      if (revision.status !== from) {
        throw new ConflictException('Revision is not in the required state');
      }
      revision.status = to;
      if (to === DictionaryRevisionStatus.IN_REVIEW) {
        revision.submittedAt = new Date();
      } else {
        revision.approvedBy = actor.actorId;
        revision.approvedAt = new Date();
      }
      await manager.save(DictionaryRevision, revision);
      await this.audit(manager, actor, {
        action:
          to === DictionaryRevisionStatus.APPROVED
            ? 'revision.approve'
            : 'revision.submit',
        entityType: 'lexeme',
        entityId: lexeme.id,
        revisionId: revision.id,
        reason,
      });
      return presentAdminLexeme(manager, lexeme, revision);
    });
  }

  private async lockLexeme(
    manager: EntityManager,
    id: number,
    expectedVersion: number,
  ): Promise<DictionaryLexeme> {
    const lexeme = await manager.findOne(DictionaryLexeme, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lexeme) throw new NotFoundException('Dictionary lexeme not found');
    if (lexeme.currentVersion !== expectedVersion) {
      throw new ConflictException('Lexeme version has changed');
    }
    return lexeme;
  }

  private async currentRevision(
    manager: EntityManager,
    lexeme: DictionaryLexeme,
  ): Promise<DictionaryRevision> {
    const revision = await manager.findOneBy(DictionaryRevision, {
      lexemeId: lexeme.id,
      version: lexeme.currentVersion,
    });
    if (!revision) {
      throw new Error('Current dictionary revision is missing');
    }
    return revision;
  }

  private async validateRevisionInput(
    manager: EntityManager,
    input: RevisionInput,
  ): Promise<void> {
    normalizeDictionaryText(input.lemma);
    if (input.partOfSpeech !== null) assertWellFormedText(input.partOfSpeech);
    for (const form of input.forms) {
      normalizeDictionaryText(form.text);
      if (form.script) assertWellFormedText(form.script);
      if (form.type) assertWellFormedText(form.type);
    }
    for (const sense of input.senses) assertWellFormedText(sense.definition);

    if (
      !(await manager.exists(DictionarySource, {
        where: { id: input.sourceId },
      }))
    ) {
      throw new BadRequestException('Dictionary source does not exist');
    }
    const conceptIds = [
      ...new Set(input.senses.flatMap((sense) => sense.conceptIds ?? [])),
    ];
    if (
      conceptIds.length > 0 &&
      (await manager.count(DictionaryConcept, {
        where: { id: In(conceptIds) },
      })) !== conceptIds.length
    ) {
      throw new BadRequestException('One or more concepts do not exist');
    }
  }

  private async createRevision(
    manager: EntityManager,
    lexeme: DictionaryLexeme,
    input: RevisionInput,
    actor: DictionaryActor,
  ): Promise<DictionaryRevision> {
    const revision = await manager.save(DictionaryRevision, {
      lexemeId: lexeme.id,
      version: lexeme.currentVersion,
      status: DictionaryRevisionStatus.DRAFT,
      lemma: input.lemma,
      normalizedLemma: normalizeDictionaryText(input.lemma),
      partOfSpeech: input.partOfSpeech,
      sourceId: input.sourceId,
      createdBy: actor.actorId,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
    });
    if (input.forms.length > 0) {
      await manager.save(
        DictionaryForm,
        input.forms.map((form) => ({
          revisionId: revision.id,
          text: form.text,
          normalizedText: normalizeDictionaryText(form.text),
          script: form.script ?? null,
          type: form.type ?? null,
        })),
      );
    }
    const senses = await manager.save(
      DictionarySense,
      input.senses.map((sense, index) => ({
        revisionId: revision.id,
        position: index + 1,
        definition: sense.definition,
      })),
    );
    const links = senses.flatMap((sense, index) =>
      (input.senses[index].conceptIds ?? []).map((conceptId) => ({
        senseId: sense.id,
        conceptId,
      })),
    );
    if (links.length > 0) {
      await manager.insert(DictionarySenseConcept, links);
    }
    return revision;
  }

  private async publicationState(
    manager: EntityManager,
    lock = false,
  ): Promise<DictionaryPublicationState> {
    const state = await manager.findOne(DictionaryPublicationState, {
      where: { id: 1 },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!state) throw new Error('Dictionary publication state is missing');
    return state;
  }

  private async audit(
    manager: EntityManager,
    actor: DictionaryActor,
    input: AuditInput,
  ): Promise<void> {
    await manager.save(DictionaryAuditLog, {
      actorId: actor.actorId,
      requestId: actor.requestId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      revisionId: input.revisionId ?? null,
      previousRevisionId: input.previousRevisionId ?? null,
      reason: input.reason ?? null,
    });
  }

  private presentSource(source: DictionarySource) {
    return {
      id: source.id,
      name: source.name,
      license: source.license,
      attribution: source.attribution,
      url: source.url,
      createdAt: source.createdAt,
    };
  }
}

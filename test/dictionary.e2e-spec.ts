import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'superagent';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CreateDictionarySchema1767000000000 } from '../src/database/migrations/1767000000000-CreateDictionarySchema';
import { UserRole } from '../src/users/domain/user-role.enum';
import { User } from '../src/users/entities/user.entity';
import { assertIsolatedTestDatabase } from './isolated-db';

interface Success<T> {
  ok: true;
  requestId: string;
  data: T;
}

interface Revision {
  id: number;
  version: number;
  status: string;
  lemma: string;
}

interface AdminLexeme {
  id: number;
  currentVersion: number;
  revision: Revision;
}

interface LiveLexeme {
  id: number;
  lemma: string;
  languageTag: string;
  contentRevisionId: number;
  senses: { definition: string; conceptIds: number[] }[];
}

interface SearchResult {
  publicationId: number | null;
  items: LiveLexeme[];
  nextCursor: string | null;
}

function data<T>(response: Response): T {
  const body = response.body as Success<T>;
  expect(body.ok).toBe(true);
  expect(body.requestId).toBeTruthy();
  return body.data;
}

const describeIsolated =
  process.env.ISOLATED_DATABASE_E2E === 'true' ? describe : describe.skip;

describeIsolated('Dictionary API (isolated MariaDB e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let userToken: string;
  let adminId: number;
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    assertIsolatedTestDatabase();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const users = app.get(DataSource).getRepository(User);
    const admin = await users.save(
      users.create({
        username: `dict-admin-${suffix}`,
        role: UserRole.ADMIN,
        password: null,
        email: null,
        name: null,
      }),
    );
    const user = await users.save(
      users.create({
        username: `dict-user-${suffix}`,
        role: UserRole.USER,
        password: null,
        email: null,
        name: null,
      }),
    );
    adminId = admin.id;
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    adminToken = jwt.sign({ sub: admin.id, username: admin.username, sv: 0 });
    userToken = jwt.sign({ sub: user.id, username: user.username, sv: 0 });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps system and languages public while protecting and validating admin routes', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

    const languages = data<{ code: string }[]>(
      await request(app.getHttpServer()).get('/api/v1/languages').expect(200),
    );
    expect(languages.map((language) => language.code)).toEqual([
      'en',
      'ko',
      'ja',
      'zh-Hans',
      'zh-Hant',
    ]);

    const source = {
      name: `Original ${suffix}`,
      license: 'author-created',
      attribution: 'Test author',
    };
    await request(app.getHttpServer())
      .post('/api/v1/admin/sources')
      .send(source)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/sources')
      .auth(userToken, { type: 'bearer' })
      .send(source)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/sources')
      .auth(adminToken, { type: 'bearer' })
      .send({ ...source, actorId: 999 })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/lexemes')
      .query({ language: 'zh-CN' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/lexemes')
      .query({ cursor: 'not-valid-json' })
      .expect(400);
  });

  it('reports database readiness failures without changing liveness', async () => {
    const query = jest
      .spyOn(app.get(DataSource), 'query')
      .mockRejectedValueOnce(new Error('Database connection unavailable'));
    try {
      await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(503);
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);
    } finally {
      query.mockRestore();
    }
  });

  it('publishes reviewed revisions atomically without exposing later drafts', async () => {
    const source = data<{ id: number }>(
      await request(app.getHttpServer())
        .post('/api/v1/admin/sources')
        .auth(adminToken, { type: 'bearer' })
        .set('X-Request-Id', `dictionary-${suffix}`)
        .send({
          name: `Original ${suffix}`,
          license: 'author-created',
          attribution: 'Test author',
        })
        .expect(201),
    );
    const concept = data<{ id: number }>(
      await request(app.getHttpServer())
        .post('/api/v1/admin/concepts')
        .auth(adminToken, { type: 'bearer' })
        .send({ description: `Concept ${suffix}` })
        .expect(201),
    );
    const createLexeme = async (
      languageTag: string,
      lemma: string,
      forms: { text: string; script?: string; type?: string }[] = [],
    ): Promise<AdminLexeme> =>
      data<AdminLexeme>(
        await request(app.getHttpServer())
          .post('/api/v1/admin/lexemes')
          .auth(adminToken, { type: 'bearer' })
          .send({
            languageTag,
            lemma,
            sourceId: source.id,
            partOfSpeech: 'noun',
            forms,
            senses: [
              {
                definition: `Original definition ${suffix}`,
                conceptIds: [concept.id],
              },
            ],
          })
          .expect(201),
      );

    const korean = await createLexeme('ko', `가${suffix}`, [
      { text: `한글${suffix}𠀀`, script: 'Hang', type: 'variant' },
    ]);
    const english = await createLexeme('en', `Hello${suffix}`);
    const literal = await createLexeme('ja', `検索${suffix}%`);
    const wildcardDecoy = await createLexeme('ja', `検索${suffix}x`);
    const simplified = await createLexeme('zh-Hans', `汉${suffix}`);
    const variationA = await createLexeme('zh-Hant', `漢\u{E0100}${suffix}`);
    const variationB = await createLexeme('zh-Hant', `漢\u{E0101}${suffix}`);
    expect(korean.revision.status).toBe('draft');

    const sources = data<{
      items: { id: number }[];
      page: number;
      limit: number;
    }>(
      await request(app.getHttpServer())
        .get('/api/v1/admin/sources')
        .auth(adminToken, { type: 'bearer' })
        .query({ limit: 100 })
        .expect(200),
    );
    expect(sources).toMatchObject({ page: 1, limit: 100 });
    expect(sources.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: source.id })]),
    );
    const concepts = data<{ items: { id: number }[] }>(
      await request(app.getHttpServer())
        .get('/api/v1/admin/concepts')
        .auth(adminToken, { type: 'bearer' })
        .query({ limit: 100 })
        .expect(200),
    );
    expect(concepts.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: concept.id })]),
    );
    const adminLexemes = data<{ items: { id: number; status: string }[] }>(
      await request(app.getHttpServer())
        .get('/api/v1/admin/lexemes')
        .auth(adminToken, { type: 'bearer' })
        .query({ status: 'draft', limit: 100 })
        .expect(200),
    );
    expect(adminLexemes.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: korean.id, status: 'draft' }),
      ]),
    );
    const adminDetail = data<AdminLexeme>(
      await request(app.getHttpServer())
        .get(`/api/v1/admin/lexemes/${korean.id}`)
        .auth(adminToken, { type: 'bearer' })
        .expect(200),
    );
    expect(adminDetail.revision).toMatchObject({
      id: korean.revision.id,
      lemma: korean.revision.lemma,
      status: 'draft',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/lexemes/${korean.id}`)
      .expect(404);
    const drafts = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `가${suffix}`, language: 'ko' })
        .expect(200),
    );
    expect(drafts.items).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/v1/concepts/${concept.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/admin/lexemes')
      .auth(adminToken, { type: 'bearer' })
      .send({
        languageTag: 'ko',
        lemma: 'invalid',
        sourceId: source.id,
        senses: [{ definition: 'Invalid concept', conceptIds: [2147483647] }],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/lexemes/${korean.id}/approve`)
      .auth(adminToken, { type: 'bearer' })
      .send({ expectedVersion: 1, reason: 'Reviewed' })
      .expect(409);

    const current = data<{ publicationId: number | null }>(
      await request(app.getHttpServer())
        .get('/api/v1/admin/publications/current')
        .auth(adminToken, { type: 'bearer' })
        .expect(200),
    );
    await request(app.getHttpServer())
      .post('/api/v1/admin/publications')
      .auth(adminToken, { type: 'bearer' })
      .send({
        revisionIds: [korean.revision.id],
        expectedCurrentPublicationId: current.publicationId,
        reason: 'Unreviewed',
      })
      .expect(409);

    for (const lexeme of [
      korean,
      english,
      literal,
      wildcardDecoy,
      simplified,
      variationA,
      variationB,
    ]) {
      const submitted = data<AdminLexeme>(
        await request(app.getHttpServer())
          .post(`/api/v1/admin/lexemes/${lexeme.id}/submit`)
          .auth(adminToken, { type: 'bearer' })
          .send({ expectedVersion: 1 })
          .expect(200),
      );
      expect(submitted.revision.status).toBe('in_review');
      const approved = data<AdminLexeme>(
        await request(app.getHttpServer())
          .post(`/api/v1/admin/lexemes/${lexeme.id}/approve`)
          .auth(adminToken, { type: 'bearer' })
          .send({ expectedVersion: 1, reason: 'Reviewed' })
          .expect(200),
      );
      expect(approved.revision.status).toBe('approved');
    }

    const publication = data<{ id: number }>(
      await request(app.getHttpServer())
        .post('/api/v1/admin/publications')
        .auth(adminToken, { type: 'bearer' })
        .send({
          revisionIds: [
            korean.revision.id,
            english.revision.id,
            literal.revision.id,
            wildcardDecoy.revision.id,
            simplified.revision.id,
            variationA.revision.id,
            variationB.revision.id,
          ],
          expectedCurrentPublicationId: current.publicationId,
          reason: 'First review',
        })
        .expect(201),
    );

    const normalized = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `가${suffix}`, language: 'ko' })
        .expect(200),
    );
    expect(normalized.publicationId).toBe(publication.id);
    expect(normalized.items.map((item) => item.id)).toEqual([korean.id]);
    expect(normalized.items[0].lemma).toBe(`가${suffix}`);
    expect(normalized.items[0].contentRevisionId).toBe(korean.revision.id);

    const formMatch = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `한글${suffix}𠀀`, language: 'ko' })
        .expect(200),
    );
    expect(formMatch.items.map((item) => item.id)).toEqual([korean.id]);

    const literalMatch = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `検索${suffix}%`, language: 'ja' })
        .expect(200),
    );
    expect(literalMatch.items.map((item) => item.id)).toEqual([literal.id]);
    const traditional = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `漢\u{E0100}${suffix}`, language: 'zh-Hant' })
        .expect(200),
    );
    expect(traditional.items.map((item) => item.id)).toEqual([variationA.id]);
    const caseInsensitive = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `hello${suffix}`, language: 'en' })
        .expect(200),
    );
    expect(caseInsensitive.items.map((item) => item.id)).toEqual([english.id]);

    const page = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({ q: `検索${suffix}`, language: 'ja', limit: 1 })
        .expect(200),
    );
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    const next = data<SearchResult>(
      await request(app.getHttpServer())
        .get('/api/v1/lexemes')
        .query({
          q: `検索${suffix}`,
          language: 'ja',
          limit: 1,
          cursor: page.nextCursor,
        })
        .expect(200),
    );
    expect(next.items).toHaveLength(1);
    expect(next.items[0].id).not.toBe(page.items[0].id);
    expect(next.nextCursor).toBeNull();
    await request(app.getHttpServer())
      .get('/api/v1/lexemes')
      .query({
        q: `different${suffix}`,
        language: 'ja',
        cursor: page.nextCursor,
      })
      .expect(400);

    const translations = data<SearchResult>(
      await request(app.getHttpServer())
        .get(`/api/v1/concepts/${concept.id}/translations`)
        .query({ targetLanguage: 'en' })
        .expect(200),
    );
    expect(translations.items.map((item) => item.id)).toEqual([english.id]);
    const publishedConcept = data<SearchResult & { concept: { id: number } }>(
      await request(app.getHttpServer())
        .get(`/api/v1/concepts/${concept.id}`)
        .expect(200),
    );
    expect(publishedConcept.concept.id).toBe(concept.id);
    expect(publishedConcept.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: korean.id }),
        expect.objectContaining({ id: english.id }),
      ]),
    );

    const draft = data<AdminLexeme>(
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/lexemes/${korean.id}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ expectedVersion: 1, lemma: `새${suffix}` })
        .expect(200),
    );
    expect(draft.currentVersion).toBe(2);
    expect(draft.revision.status).toBe('draft');
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/lexemes/${korean.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ expectedVersion: 1, lemma: 'stale' })
      .expect(409);
    const stillPublished = data<LiveLexeme & { publicationId: number }>(
      await request(app.getHttpServer())
        .get(`/api/v1/lexemes/${korean.id}`)
        .expect(200),
    );
    expect(stillPublished.lemma).toBe(`가${suffix}`);
    expect(stillPublished.contentRevisionId).toBe(korean.revision.id);
    expect(stillPublished.publicationId).toBe(publication.id);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/lexemes/${korean.id}/submit`)
      .auth(adminToken, { type: 'bearer' })
      .send({ expectedVersion: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/lexemes/${korean.id}/approve`)
      .auth(adminToken, { type: 'bearer' })
      .send({ expectedVersion: 2, reason: 'Reviewed revision' })
      .expect(200);

    const publishRequest = () =>
      request(app.getHttpServer())
        .post('/api/v1/admin/publications')
        .auth(adminToken, { type: 'bearer' })
        .send({
          revisionIds: [draft.revision.id],
          expectedCurrentPublicationId: publication.id,
          reason: 'Publish revision',
        });
    const concurrent = await Promise.all([publishRequest(), publishRequest()]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await request(app.getHttpServer())
      .get('/api/v1/lexemes')
      .query({ q: `検索${suffix}`, language: 'ja', cursor: page.nextCursor })
      .expect(409);
    const updated = data<LiveLexeme>(
      await request(app.getHttpServer())
        .get(`/api/v1/lexemes/${korean.id}`)
        .expect(200),
    );
    expect(updated.lemma).toBe(`새${suffix}`);
    expect(updated.contentRevisionId).toBe(draft.revision.id);
    expect(updated.senses[0].conceptIds).toEqual([concept.id]);
    const preserved = data<LiveLexeme & { publicationId: number }>(
      await request(app.getHttpServer())
        .get(`/api/v1/lexemes/${english.id}`)
        .expect(200),
    );
    expect(preserved.contentRevisionId).toBe(english.revision.id);
    expect(preserved.publicationId).not.toBe(publication.id);

    const reviseAgain = () =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/lexemes/${korean.id}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ expectedVersion: 2, lemma: `다음${suffix}` });
    const concurrentDrafts = await Promise.all([reviseAgain(), reviseAgain()]);
    expect(concurrentDrafts.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const stillVersionTwo = data<LiveLexeme>(
      await request(app.getHttpServer())
        .get(`/api/v1/lexemes/${korean.id}`)
        .expect(200),
    );
    expect(stillVersionTwo.contentRevisionId).toBe(draft.revision.id);

    const audit = data<{
      items: { actorId: number; requestId: string; action: string }[];
    }>(
      await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .auth(adminToken, { type: 'bearer' })
        .query({ limit: 100 })
        .expect(200),
    );
    expect(audit.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: adminId,
          requestId: `dictionary-${suffix}`,
          action: 'source.create',
        }),
      ]),
    );
  }, 30_000);

  it('enforces schema invariants and refuses to revert populated data', async () => {
    const runner = app.get(DataSource).createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await expect(
        runner.query(
          'INSERT INTO `dictionary_publication_state` (`id`) VALUES (2)',
        ),
      ).rejects.toThrow();
      await expect(
        runner.query(
          "UPDATE `dictionary_revisions` SET `status` = 'invalid' LIMIT 1",
        ),
      ).rejects.toThrow();
      await expect(
        new CreateDictionarySchema1767000000000().down(runner),
      ).rejects.toThrow('dictionary data exists');
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it.each([
    [
      'additional language',
      "INSERT INTO `dictionary_languages` VALUES ('zz', 'Test', 'Latn', 99)",
    ],
    [
      'modified seed language',
      "UPDATE `dictionary_languages` SET `name` = 'Changed' WHERE `code` = 'en'",
    ],
  ])('refuses to revert an %s', async (_case, statement) => {
    const runner = app.get(DataSource).createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(statement);
      const languages: unknown = await runner.query(
        'SELECT `code`, `name`, `script`, `sortOrder` FROM `dictionary_languages`',
      );
      const query = jest
        .spyOn(runner, 'query')
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce(languages);
      try {
        jest.spyOn(runner, 'dropTable').mockResolvedValue();
        await expect(
          new CreateDictionarySchema1767000000000().down(runner),
        ).rejects.toThrow('dictionary data exists');
      } finally {
        query.mockRestore();
      }
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CatalogPlaylist } from '../src/music/catalog/entities/catalog-playlist.entity';
import { CatalogPlaylistTrack } from '../src/music/catalog/entities/catalog-playlist-track.entity';
import { CatalogTrack } from '../src/music/catalog/entities/catalog-track.entity';
import { UserRole } from '../src/users/domain/user-role.enum';
import { User } from '../src/users/entities/user.entity';
import { assertIsolatedTestDatabase } from './isolated-db';

const describeIsolated =
  process.env.ISOLATED_DATABASE_E2E === 'true' ? describe : describe.skip;

describeIsolated('Catalog playlist concurrency (isolated MariaDB e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
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
    dataSource = app.get(DataSource);
    const users = dataSource.getRepository(User);
    const admin = await users.save(
      users.create({
        username: `catalog-admin-${suffix}`,
        role: UserRole.ADMIN,
        password: null,
        email: null,
        name: null,
      }),
    );
    adminToken = new JwtService({ secret: process.env.JWT_SECRET }).sign({
      sub: admin.id,
      username: admin.username,
      sv: 0,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('still adds tracks and swaps positions while rejecting duplicate positions', async () => {
    const playlist = await dataSource.getRepository(CatalogPlaylist).save({
      title: `Order ${suffix}`,
      description: null,
      playDate: null,
      status: 'draft',
      anonymousPlayable: false,
      publishedAt: null,
    });
    const tracks = await dataSource.getRepository(CatalogTrack).save([
      { title: `First ${suffix}`, artist: 'Test', bpm: null },
      { title: `Second ${suffix}`, artist: 'Test', bpm: null },
    ]);
    const first = await request(app.getHttpServer())
      .post(`/music/playlists/${playlist.id}/tracks`)
      .auth(adminToken, { type: 'bearer' })
      .send({ trackId: tracks[0].id, position: 1 })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/music/playlists/${playlist.id}/tracks`)
      .auth(adminToken, { type: 'bearer' })
      .send({ trackId: tracks[1].id, position: 2 })
      .expect(201);
    const firstId = (first.body as { id: number }).id;
    const secondId = (second.body as { id: number }).id;
    await request(app.getHttpServer())
      .post(`/music/playlists/${playlist.id}/tracks`)
      .auth(adminToken, { type: 'bearer' })
      .send({ trackId: tracks[1].id, position: 1 })
      .expect(400);
    const reordered = await request(app.getHttpServer())
      .patch(`/music/playlists/${playlist.id}/tracks/reorder`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        items: [
          { id: firstId, position: 2 },
          { id: secondId, position: 1 },
        ],
      })
      .expect(200);
    expect(
      (reordered.body as { id: number; position: number }[]).map((item) => [
        item.id,
        item.position,
      ]),
    ).toEqual([
      [secondId, 1],
      [firstId, 2],
    ]);
  });

  it('rejects a stale reorder after a concurrent playlist addition commits', async () => {
    const playlist = await dataSource.getRepository(CatalogPlaylist).save({
      title: `Concurrency ${suffix}`,
      description: null,
      playDate: null,
      status: 'draft',
      anonymousPlayable: false,
      publishedAt: null,
    });
    const tracks = await dataSource.getRepository(CatalogTrack).save([
      { title: `One ${suffix}`, artist: 'Test', bpm: null },
      { title: `Two ${suffix}`, artist: 'Test', bpm: null },
      { title: `Three ${suffix}`, artist: 'Test', bpm: null },
    ]);
    const items = await dataSource.getRepository(CatalogPlaylistTrack).save([
      { playlist, track: tracks[0], position: 1, note: null },
      { playlist, track: tracks[1], position: 2, note: null },
    ]);

    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let response: request.Response;
    let finishedBeforeCommit: boolean;
    try {
      await runner.manager.findOneOrFail(CatalogPlaylist, {
        where: { id: playlist.id },
        lock: { mode: 'pessimistic_write' },
      });
      await runner.manager.save(CatalogPlaylistTrack, {
        playlist: { id: playlist.id },
        track: { id: tracks[2].id },
        position: 3,
        note: null,
      });
      const reorder = request(app.getHttpServer())
        .patch(`/music/playlists/${playlist.id}/tracks/reorder`)
        .auth(adminToken, { type: 'bearer' })
        .send({
          items: [
            { id: items[0].id, position: 2 },
            { id: items[1].id, position: 1 },
          ],
        })
        .then((result) => result);
      finishedBeforeCommit = await Promise.race([
        reorder.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 250),
        ),
      ]);
      await runner.commitTransaction();
      response = await reorder;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }

    expect(finishedBeforeCommit).toBe(false);
    expect(response.status).toBe(400);
    const after = await dataSource.getRepository(CatalogPlaylistTrack).find({
      where: { playlist: { id: playlist.id } },
      order: { position: 'ASC' },
    });
    expect(after.map((item) => item.id)).toEqual([
      items[0].id,
      items[1].id,
      expect.any(Number),
    ]);
    expect(after.map((item) => item.position)).toEqual([1, 2, 3]);
  });
});

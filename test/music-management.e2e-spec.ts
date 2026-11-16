import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/users/domain/user-role.enum';
import { User } from '../src/users/entities/user.entity';
import { assertIsolatedTestDatabase } from './isolated-db';

const describeIsolated =
  process.env.ISOLATED_DATABASE_E2E === 'true' ? describe : describe.skip;

describeIsolated('music usage and statistics (isolated MariaDB)', () => {
  let app: INestApplication<App>;
  let token: string;
  const suffix = randomUUID().slice(0, 8);
  beforeAll(async () => {
    assertIsolatedTestDatabase();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const users = app.get(DataSource).getRepository(User);
    const admin = await users.save({
      username: `music-admin-${suffix}`,
      role: UserRole.ADMIN,
      password: null,
      email: null,
      name: null,
    });
    token = new JwtService({ secret: process.env.JWT_SECRET }).sign({
      sub: admin.id,
      username: admin.username,
      sv: 0,
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('snapshots a playlist and aggregates only confirmed, nonexcluded usage', async () => {
    const server = app.getHttpServer();
    await request(server).get('/music/management/artists').expect(401);
    const artist = await request(server)
      .post('/music/management/artists')
      .auth(token, { type: 'bearer' })
      .send({ name: `Artist ${suffix}` })
      .expect(201);
    const artistId = (artist.body as { id: number }).id;
    const work = await request(server)
      .post('/music/management/works')
      .auth(token, { type: 'bearer' })
      .send({ title: `Work ${suffix}` })
      .expect(201);
    const workId = (work.body as { id: number }).id;
    const track = await request(server)
      .post('/music/tracks')
      .auth(token, { type: 'bearer' })
      .send({ title: `Live ${suffix}`, artist: `Artist ${suffix}` })
      .expect(201);
    const trackId = (track.body as { id: number }).id;
    await request(server)
      .patch(`/music/management/recordings/${trackId}`)
      .auth(token, { type: 'bearer' })
      .send({ workId, artistIds: [artistId], recordingType: 'live' })
      .expect(200);
    const playlist = await request(server)
      .post('/music/playlists')
      .auth(token, { type: 'bearer' })
      .send({ title: `Set ${suffix}` })
      .expect(201);
    const playlistId = (playlist.body as { id: number }).id;
    for (const position of [1, 2])
      await request(server)
        .post(`/music/playlists/${playlistId}/tracks`)
        .auth(token, { type: 'bearer' })
        .send({ trackId, position })
        .expect(201);
    const usage = await request(server)
      .post('/music/management/usages')
      .auth(token, { type: 'bearer' })
      .send({
        playlistId,
        usedAt: '2026-01-15T12:00:00Z',
        location: `Hall ${suffix}`,
      })
      .expect(201);
    const usageId = (usage.body as { id: number }).id;
    const detail = await request(server)
      .get(`/music/management/usages/${usageId}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    const items = (detail.body as { items: { id: number }[] }).items;
    expect(items).toHaveLength(2);
    await request(server)
      .patch(`/music/management/usages/${usageId}/items/${items[0].id}`)
      .auth(token, { type: 'bearer' })
      .send({ playCount: 2 })
      .expect(200);
    await request(server)
      .patch(`/music/management/usages/${usageId}/items/${items[1].id}`)
      .auth(token, { type: 'bearer' })
      .send({ playCount: 0 })
      .expect(200);
    await request(server)
      .post(`/music/management/usages/${usageId}/confirm`)
      .auth(token, { type: 'bearer' })
      .expect(201);
    await request(server)
      .patch(`/music/management/usages/${usageId}/items/${items[0].id}`)
      .auth(token, { type: 'bearer' })
      .send({ playCount: 3 })
      .expect(400);
    const stats = await request(server)
      .get('/music/management/statistics')
      .auth(token, { type: 'bearer' })
      .query({
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        location: `Hall ${suffix}`,
      })
      .expect(200);
    const body = stats.body as {
      recordings: { id: number; count: number }[];
      artists: { id: number; count: number }[];
      works: { id: number; count: number }[];
      assets: { id: number | null; count: number }[];
    };
    expect(body.recordings).toContainEqual(
      expect.objectContaining({ id: trackId, count: 2 }),
    );
    expect(body.artists).toContainEqual(
      expect.objectContaining({ id: artistId, count: 2 }),
    );
    expect(body.works).toContainEqual(
      expect.objectContaining({ id: workId, count: 2 }),
    );
    expect(body.assets).toContainEqual(
      expect.objectContaining({ id: null, count: 2 }),
    );
  });
});

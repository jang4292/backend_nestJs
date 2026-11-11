import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Welcome to NestJS Backend API!');
  });

  // SEC-17: Express 라우팅은 대소문자를 구분하지 않으므로, 경로 철자와 무관하게 비활성 provider는 503이어야 합니다.
  it.each(['/auth/google/login', '/auth/GOOGLE/login', '/auth/Kakao/login'])(
    '%s (POST) is blocked while the provider is disabled',
    (path) => {
      return request(app.getHttpServer())
        .post(path)
        .send({ idToken: 'x', accessToken: 'x' })
        .expect(503)
        .expect((res) => {
          const body = res.body as { ok?: boolean; errorCode?: string };
          expect(body.ok).toBe(false);
          expect(body.errorCode).toMatch(/^AUTH_(GOOGLE|KAKAO)_DISABLED$/);
        });
    },
  );

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('timestamp');
      });
  });
});

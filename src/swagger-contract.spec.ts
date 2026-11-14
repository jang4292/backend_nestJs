import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AuthLocalController } from './auth/local/interface/auth-local.controller';
import { LocalLoginUseCase } from './auth/local/application/use-cases/local-login.use-case';
import { GoogleLoginUseCase } from './auth/google/application/use-cases/google-login.use-case';
import { ExchangeGoogleAuthCodeUseCase } from './auth/google/application/use-cases/exchange-google-auth-code.use-case';
import { VerifyGoogleIdTokenUseCase } from './auth/google/application/use-cases/verify-google-id-token.use-case';
import { AuthGoogleController } from './auth/google/interface/auth-google.controller';
import { ApiErrorResponseDto } from './common/http/api-contract.dto';
import { RequestIdService } from './common/request-id/request-id.service';
import { AppController, HealthResponse } from './app.controller';
import { AppService } from './app.service';
import { MusicController } from './music/interface/music.controller';
import { MusicService } from './music/music.service';
import { CatalogMusicController } from './music/catalog/interface/catalog-music.controller';
import { CatalogMusicService } from './music/catalog/catalog-music.service';
import { UsersController } from './users/interface/users.controller';
import { UsersService } from './users/users.service';
import { DictionaryAdminController } from './dictionary/interface/dictionary-admin.controller';
import { DictionaryLiveController } from './dictionary/interface/dictionary-live.controller';
import { DictionaryHealthController } from './dictionary/interface/dictionary-health.controller';
import { DictionaryAdminService } from './dictionary/application/dictionary-admin.service';
import { DictionaryLiveService } from './dictionary/application/dictionary-live.service';

describe('OpenAPI contract', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AppController,
        UsersController,
        AuthLocalController,
        AuthGoogleController,
        CatalogMusicController,
        MusicController,
        DictionaryAdminController,
        DictionaryLiveController,
        DictionaryHealthController,
      ],
      providers: [
        { provide: AppService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: LocalLoginUseCase, useValue: {} },
        { provide: GoogleLoginUseCase, useValue: {} },
        { provide: ExchangeGoogleAuthCodeUseCase, useValue: {} },
        { provide: VerifyGoogleIdTokenUseCase, useValue: {} },
        { provide: RequestIdService, useValue: {} },
        { provide: CatalogMusicService, useValue: {} },
        { provide: MusicService, useValue: {} },
        { provide: DictionaryAdminService, useValue: {} },
        { provide: DictionaryLiveService, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Contract test')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    await app.close();
  });

  it('describes DTO validation, defaults, and concrete response schemas', () => {
    const listTracks = document.paths['/music/tracks']?.get;
    const pageParameter = listTracks?.parameters?.find(
      (parameter) => 'name' in parameter && parameter.name === 'page',
    );
    expect(pageParameter).toMatchObject({
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'integer', default: 1 },
    });
    const limitParameter = listTracks?.parameters?.find(
      (parameter) => 'name' in parameter && parameter.name === 'limit',
    );
    expect(limitParameter).toMatchObject({
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', maximum: 100 },
    });
    expect(responseSchema(listTracks, '200')).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/CatalogTrackSummaryResponseDto' },
    });

    const createTrack = document.paths['/music/tracks']?.post;
    expect(requestBodySchema(createTrack)).toEqual({
      $ref: '#/components/schemas/CreateCatalogTrackDto',
    });
    expect(document.components?.schemas?.CreateCatalogTrackDto).toMatchObject({
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        bpm: { type: 'integer', minimum: 0, maximum: 400 },
      },
      required: ['title', 'artist'],
    });
    expect(responseSchema(createTrack, '201')).toEqual({
      $ref: '#/components/schemas/CatalogTrackResponseDto',
    });
    expect(responseSchema(createTrack, '401')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });
    expect(responseSchema(createTrack, '403')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });
    expect(createTrack?.security).toEqual([{ bearer: [] }]);

    const updateTrack = document.paths['/music/tracks/{id}']?.patch;
    expect(requestBodySchema(updateTrack)).toEqual({
      $ref: '#/components/schemas/UpdateCatalogTrackDto',
    });
    expect(document.components?.schemas?.UpdateCatalogTrackDto).toMatchObject({
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        bpm: { type: 'integer', minimum: 0, maximum: 400 },
      },
    });
  });

  it('documents auth, common errors, response envelopes, and route groups', () => {
    const profile = document.paths['/users/profile']?.get;
    expect(profile?.security).toEqual([{ bearer: [] }]);
    expect(responseSchema(profile, '200')).toEqual({
      $ref: '#/components/schemas/PublicUser',
    });
    expect(responseSchema(profile, '401')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });

    const localLogin = document.paths['/auth/login']?.post;
    expect(responseSchema(localLogin, '201')).toEqual({
      $ref: '#/components/schemas/LocalLoginResponse',
    });

    const googleLogin = document.paths['/auth/google/login']?.post;
    expect(responseSchema(googleLogin, '200')).toEqual({
      $ref: '#/components/schemas/ApiSuccessResponseDto',
    });
    expect(responseSchema(googleLogin, '503')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });

    const publicPlaylist = document.paths['/music/public/playlists']?.get;
    expect(publicPlaylist?.security).toBeUndefined();
    expect(responseSchema(publicPlaylist, 'default')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });

    expect(document.paths['/music/tracks']?.get?.tags).toEqual([
      'music-catalog',
    ]);
    expect(document.paths['/music/legacy/tracks']?.get?.tags).toEqual([
      'music-legacy',
    ]);
    expect(document.components?.schemas).not.toHaveProperty('CatalogTrack');
  });

  it('documents the health check 503 response with its actual payload', () => {
    expect(responseSchema(document.paths['/health']?.get, '503')).toEqual({
      $ref: `#/components/schemas/${HealthResponse.name}`,
    });
    expect(
      document.components?.schemas?.[ApiErrorResponseDto.name],
    ).toBeDefined();
  });

  it('documents concrete dictionary envelopes and administrator authorization', () => {
    const search = document.paths['/api/v1/lexemes']?.get;
    expect(search?.security).toBeUndefined();
    expect(responseSchema(search, '200')).toEqual({
      $ref: '#/components/schemas/DictionarySearchResponseDto',
    });
    expect(document.components?.schemas?.DictionarySearchDataDto).toMatchObject(
      {
        properties: {
          publicationId: { type: 'integer', nullable: true },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/DictionaryPublicLexemeDto' },
          },
          nextCursor: { type: 'string', nullable: true },
        },
      },
    );

    const create = document.paths['/api/v1/admin/lexemes']?.post;
    expect(create?.security).toEqual([{ bearer: [] }]);
    expect(requestBodySchema(create)).toEqual({
      $ref: '#/components/schemas/CreateDictionaryLexemeDto',
    });
    expect(responseSchema(create, '201')).toEqual({
      $ref: '#/components/schemas/DictionaryAdminLexemeResponseDto',
    });
    expect(responseSchema(create, '401')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });
    expect(responseSchema(create, '403')).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });
  });
});

function responseSchema(
  operation: OperationObject | undefined,
  status: string,
): unknown {
  const response = operation?.responses?.[status];
  if (!response || !('content' in response)) {
    return undefined;
  }
  return response.content?.['application/json']?.schema;
}

function requestBodySchema(operation: OperationObject | undefined): unknown {
  const requestBody = operation?.requestBody;
  if (!requestBody || !('content' in requestBody)) {
    return undefined;
  }
  return requestBody.content?.['application/json']?.schema;
}

import { readFileSync } from 'fs';
import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import type { AppEnv } from '../config/app-env';
import { Artist } from '../music/entities/artist.entity';
import { PlaylistTrack } from '../music/entities/playlist-track.entity';
import { Playlist } from '../music/entities/playlist.entity';
import { Track } from '../music/entities/track.entity';
import { AudioAsset } from '../music/catalog/entities/audio-asset.entity';
import { CatalogTrack } from '../music/catalog/entities/catalog-track.entity';
import { CatalogPlaylist } from '../music/catalog/entities/catalog-playlist.entity';
import { CatalogPlaylistTrack } from '../music/catalog/entities/catalog-playlist-track.entity';
import { SocialAccount } from '../users/entities/social-account.entity';
import { User } from '../users/entities/user.entity';
import { dictionaryEntities } from '../dictionary/entities/dictionary.entities';

export type ReadCaFile = (filePath: string, encoding: BufferEncoding) => string;

/**
 * 실행 중인 파일과 같은 위치의 migration을 찾습니다.
 * - ts-node·jest(src/*.ts) → src/database/migrations/*.ts
 * - 빌드 결과(dist/*.js)  → dist/database/migrations/*.js (.d.ts 제외)
 * cwd와 무관하게 동작하므로 PM2·npm script·e2e 어디서 실행해도 같은 목록을 읽습니다.
 */
export const DEFAULT_MIGRATIONS_GLOB = join(
  __dirname,
  'migrations',
  `*.${__filename.endsWith('.ts') ? 'ts' : 'js'}`,
);

export interface DatabaseConfig {
  DB_TYPE?: 'mariadb';
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DATABASE_URL?: string;
  DB_SYNCHRONIZE: boolean;
  DB_SSL: boolean;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  DB_SSL_CA?: string;
  DB_POOL_MIN?: number;
  DB_POOL_MAX?: number;
  DB_CONNECT_TIMEOUT_MS?: number;
  logging?: boolean;
  migrations?: string[];
}

export const databaseEntities = [
  User,
  SocialAccount,
  Artist,
  Track,
  Playlist,
  PlaylistTrack,
  CatalogTrack,
  AudioAsset,
  CatalogPlaylist,
  CatalogPlaylistTrack,
  ...dictionaryEntities,
];

export function createDatabaseOptions(
  config: DatabaseConfig,
  readCaFile: ReadCaFile = readFileSync,
): DataSourceOptions {
  const dbType = config.DB_TYPE ?? 'mariadb';

  const sslOptions = createSslOptions(config, readCaFile);

  const extraOptions = {
    ...(config.DB_CONNECT_TIMEOUT_MS
      ? { connectTimeout: config.DB_CONNECT_TIMEOUT_MS }
      : {}),
    ...(config.DB_POOL_MAX !== undefined
      ? { connectionLimit: config.DB_POOL_MAX }
      : {}),
  };

  return {
    type: dbType,
    ...(config.DATABASE_URL
      ? { url: config.DATABASE_URL }
      : {
          host: config.DB_HOST,
          port: config.DB_PORT,
          username: config.DB_USERNAME,
          password: config.DB_PASSWORD,
          database: config.DB_DATABASE,
        }),
    entities: databaseEntities,
    migrations: config.migrations ?? [DEFAULT_MIGRATIONS_GLOB],
    synchronize: config.DB_SYNCHRONIZE,
    logging: config.logging ?? false,
    ...(sslOptions ? { ssl: sslOptions } : {}),
    ...(Object.keys(extraOptions).length > 0 ? { extra: extraOptions } : {}),
  };
}

/** mysql2 `ssl` 옵션. 앱(TypeORM)과 DB 관리 도구(db-tool)가 같은 TLS 설정을 사용합니다. */
export function createSslOptions(
  config: Pick<
    DatabaseConfig,
    'DB_SSL' | 'DB_SSL_REJECT_UNAUTHORIZED' | 'DB_SSL_CA'
  >,
  readCaFile: ReadCaFile = readFileSync,
): { rejectUnauthorized: boolean; ca?: string } | undefined {
  if (!config.DB_SSL) {
    return undefined;
  }
  return {
    rejectUnauthorized: config.DB_SSL_REJECT_UNAUTHORIZED,
    ...(config.DB_SSL_CA ? { ca: readCaFile(config.DB_SSL_CA, 'utf8') } : {}),
  };
}

/**
 * CLI(migration, db-tool)용 DB 설정. 검증된 AppEnv에서 만들며, CLI에서는 synchronize를 항상 끕니다.
 */
export function cliDatabaseConfig(
  env: Pick<
    AppEnv,
    | 'DB_TYPE'
    | 'DB_HOST'
    | 'DB_PORT'
    | 'DB_USERNAME'
    | 'DB_PASSWORD'
    | 'DB_DATABASE'
    | 'DATABASE_URL'
    | 'DB_SSL'
    | 'DB_SSL_REJECT_UNAUTHORIZED'
    | 'DB_SSL_CA'
    | 'DB_POOL_MIN'
    | 'DB_POOL_MAX'
    | 'DB_CONNECT_TIMEOUT_MS'
  >,
): DatabaseConfig {
  return {
    DB_TYPE: env.DB_TYPE,
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_USERNAME: env.DB_USERNAME,
    DB_PASSWORD: env.DB_PASSWORD,
    DB_DATABASE: env.DB_DATABASE,
    DATABASE_URL: env.DATABASE_URL,
    DB_SYNCHRONIZE: false,
    DB_SSL: env.DB_SSL,
    DB_SSL_REJECT_UNAUTHORIZED: env.DB_SSL_REJECT_UNAUTHORIZED,
    DB_SSL_CA: env.DB_SSL_CA,
    DB_POOL_MIN: env.DB_POOL_MIN,
    DB_POOL_MAX: env.DB_POOL_MAX,
    DB_CONNECT_TIMEOUT_MS: env.DB_CONNECT_TIMEOUT_MS,
    migrations: [DEFAULT_MIGRATIONS_GLOB],
  };
}

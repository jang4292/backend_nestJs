import { readFileSync } from 'fs';
import { DataSourceOptions } from 'typeorm';
import { Artist } from '../music/entities/artist.entity';
import { PlaylistTrack } from '../music/entities/playlist-track.entity';
import { Playlist } from '../music/entities/playlist.entity';
import { Track } from '../music/entities/track.entity';
import { SocialAccount } from '../users/entities/social-account.entity';
import { User } from '../users/entities/user.entity';

type ReadCaFile = (filePath: string, encoding: BufferEncoding) => string;

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
];

export function createDatabaseOptions(
  config: DatabaseConfig,
  readCaFile: ReadCaFile = readFileSync,
): DataSourceOptions {
  const dbType = config.DB_TYPE ?? 'mariadb';

  const sslOptions = config.DB_SSL
    ? {
        rejectUnauthorized: config.DB_SSL_REJECT_UNAUTHORIZED,
        ...(config.DB_SSL_CA
          ? { ca: readCaFile(config.DB_SSL_CA, 'utf8') }
          : {}),
      }
    : undefined;

  const extraOptions = {
    ...(config.DB_CONNECT_TIMEOUT_MS
      ? { connectionTimeoutMillis: config.DB_CONNECT_TIMEOUT_MS }
      : {}),
    ...(config.DB_POOL_MIN !== undefined ? { min: config.DB_POOL_MIN } : {}),
    ...(config.DB_POOL_MAX !== undefined ? { max: config.DB_POOL_MAX } : {}),
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
    migrations: config.migrations ?? ['dist/database/migrations/*.js'],
    synchronize: config.DB_SYNCHRONIZE,
    logging: config.logging ?? false,
    ...(sslOptions ? { ssl: sslOptions } : {}),
    ...(Object.keys(extraOptions).length > 0 ? { extra: extraOptions } : {}),
  };
}

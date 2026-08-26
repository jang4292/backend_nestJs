import { DataSourceOptions } from 'typeorm';
import { PlaylistTrack } from '../music/entities/playlist-track.entity';
import { Playlist } from '../music/entities/playlist.entity';
import { Track } from '../music/entities/track.entity';
import { User } from '../users/entities/user.entity';

export interface DatabaseConfig {
  DB_TYPE?: 'postgres' | 'mysql';
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DATABASE_URL?: string;
  DB_SYNCHRONIZE: boolean;
  DB_SSL: boolean;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  logging?: boolean;
  migrations?: string[];
}

export const databaseEntities = [User, Track, Playlist, PlaylistTrack];

export function createDatabaseOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  const dbType = config.DB_TYPE ?? 'postgres';

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
    // SSL 옵션은 현재 postgres(RDS) 연결에서만 사용됨 — mysql 재도입 시 mysql2 SSL 옵션 형식으로 별도 검토 필요
    ...(dbType === 'postgres' && config.DB_SSL
      ? {
          ssl: {
            rejectUnauthorized: config.DB_SSL_REJECT_UNAUTHORIZED,
          },
        }
      : {}),
  };
}

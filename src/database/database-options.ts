import { DataSourceOptions } from 'typeorm';
import { PlaylistTrack } from '../music/entities/playlist-track.entity';
import { Playlist } from '../music/entities/playlist.entity';
import { Track } from '../music/entities/track.entity';
import { User } from '../users/entities/user.entity';

export interface DatabaseConfig {
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
  return {
    type: 'postgres',
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
    ...(config.DB_SSL
      ? {
          ssl: {
            rejectUnauthorized: config.DB_SSL_REJECT_UNAUTHORIZED,
          },
        }
      : {}),
  };
}

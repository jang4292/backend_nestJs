import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuthGoogleModule } from './auth/google/auth-google.module';
import { CommonModule } from './common/common.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdInterceptor } from './common/request-id/request-id.interceptor';
import { validateAppEnv } from './config/app-env';
import { UsersModule } from './users/users.module';
import { MusicModule } from './music/music.module';
import { createDatabaseOptions } from './database/database-options';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      validate: validateAppEnv,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        createDatabaseOptions({
          DB_HOST: configService.get<string>('DB_HOST', 'localhost'),
          DB_PORT: configService.get<number>('DB_PORT', 5432),
          DB_USERNAME: configService.get<string>('DB_USERNAME', 'postgres'),
          DB_PASSWORD: configService.get<string>('DB_PASSWORD', 'password'),
          DB_DATABASE: configService.get<string>('DB_DATABASE', 'nestjs_db'),
          DATABASE_URL: configService.get<string>('DATABASE_URL'),
          DB_SYNCHRONIZE: configService.get<boolean>('DB_SYNCHRONIZE', false),
          DB_SSL: configService.get<boolean>('DB_SSL', false),
          DB_SSL_REJECT_UNAUTHORIZED: configService.get<boolean>(
            'DB_SSL_REJECT_UNAUTHORIZED',
            true,
          ),
          DB_SSL_CA: configService.get<string>('DB_SSL_CA'),
          DB_POOL_MIN: configService.get<number>('DB_POOL_MIN'),
          DB_POOL_MAX: configService.get<number>('DB_POOL_MAX'),
          DB_CONNECT_TIMEOUT_MS: configService.get<number>(
            'DB_CONNECT_TIMEOUT_MS',
          ),
          logging: configService.get<string>('NODE_ENV') === 'development',
        }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: configService.get<number>('THROTTLE_LIMIT', 10),
        },
      ],
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    AuthGoogleModule,
    CommonModule,
    MusicModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

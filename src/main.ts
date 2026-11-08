import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { TrustProxySetting } from './config/app-env';
import { REQUEST_ID_HEADER } from './common/request-id/request-id.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // reverse proxy 뒤에서는 req.ip가 실제 클라이언트 IP가 되도록 설정합니다.
  // (ThrottlerGuard가 req.ip 기준으로 요청 수를 집계합니다.)
  app.set(
    'trust proxy',
    configService.get<TrustProxySetting>('TRUST_PROXY', false),
  );

  // SIGTERM/SIGINT 수신 시 진행 중인 요청과 DB 커넥션 풀을 정리하고 종료합니다.
  app.enableShutdownHooks();

  // Security: Enable Helmet
  app.use(helmet());

  // Security: Enable CORS (CORS_ORIGIN은 app-env.ts에서 쉼표 목록으로 파싱·검증됩니다)
  const corsOrigins = configService.get<string[]>('CORS_ORIGINS', []);
  if (corsOrigins.length === 0) {
    logger.warn(
      'CORS_ORIGIN is not set. CORS is disabled. Set CORS_ORIGIN in production!',
    );
  }

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  // Enable global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API docs (개발 환경에서만 노출 — 프로덕션에서 API 스펙 노출 방지)
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Backend NestJs API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(configService.get<number>('PORT', 3000));
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();

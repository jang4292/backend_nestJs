import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security: Enable Helmet
  app.use(helmet());

  // Security: Enable CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  if (!corsOrigin) {
    console.warn(
      'WARNING: CORS_ORIGIN is not set. CORS is disabled for development. Set CORS_ORIGIN in production!',
    );
  }

  app.enableCors({
    origin: corsOrigin || false, // false disables CORS if not configured, safer default
    credentials: true,
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
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();

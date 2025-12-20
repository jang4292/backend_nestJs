import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Enable Helmet
  app.use(helmet());

  // Security: Enable CORS
  const corsOrigin = process.env.CORS_ORIGIN;
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

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();

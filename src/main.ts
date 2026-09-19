import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

import { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  const port = configService.get<number>('PORT');
  const apiPrefix = configService.get<string>('API_PREFIX');

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Prefix (excluding standard root health probes for Kubernetes/Docker)
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      'health',
      'health/live',
      'health/liveness',
      'health/ready',
      'health/readiness',
    ],
  });

  // Serve static uploads
  const uploadDest = configService.get<string>('UPLOAD_DEST');
  app.useStaticAssets(path.resolve(process.cwd(), uploadDest), {
    prefix: '/uploads/',
  });

  // Global Zod validation pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // Global exception filter and response transformer
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('News Portal Backend API')
    .setDescription(
      'Enterprise News Portal API with Editorial Workflow, RBAC, Taxonomy, Redis Caching, and Media Management',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(
    `News Portal Backend is running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(
    `Swagger OpenAPI Documentation: http://localhost:${port}/api/docs`,
  );
}

void bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  // Railway injects PORT; fall back to APP_PORT / 3000 for local dev
  const port = process.env.PORT || config.get<string>('APP_PORT', '3000');
  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');

  // Security middleware
  app.use(helmet.default());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Health check — no global prefix, used by Railway
  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Global validation pipe
  app.setGlobalPrefix('api/v1');

  // Serve uploaded files at /uploads/*
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MedMatch API')
    .setDescription(
      'Super App API สำหรับวงการทันตกรรม & การแพทย์ — Job Matching + Patient Booking + Clinic Management',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & User Management')
    .addTag('Profile — Seeker', 'Seeker/Provider Profile Management')
    .addTag('Profile — Clinic', 'Clinic Profile Management')
    .addTag('Profile — Patient', 'Patient Profile Management')
    .addTag('Jobs', 'Job Matching (Tinder-style)')
    .addTag('Booking', 'Patient Booking System')
    .addTag('Chat', 'Real-time Chat')
    .addTag('Payment', 'Payment & Accounting')
    .addTag('Reviews', 'Rating & Review System')
    .addTag('Map', 'Map & Location Services')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`
╔══════════════════════════════════════════════╗
║     🏥 MedMatch API Server                   ║
║     Running on: http://localhost:${port}        ║
║     Swagger:    http://localhost:${port}/api/docs║
║     Environment: ${config.get('APP_ENV', 'dev')}                    ║
╚══════════════════════════════════════════════╝
  `);
}

bootstrap();

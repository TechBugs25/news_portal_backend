import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Health & Checkpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // Allow asynchronous redis connection to establish
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health/live (GET) should return 200 and liveness status', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('ok');
        expect(res.body.data.check).toBe('liveness');
        expect(typeof res.body.data.uptimeSeconds).toBe('number');
        expect(res.body.data.memoryUsage).toBeDefined();
      });
  });

  it('/health/ready (GET) should return 200 and readiness status with database', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((res) => {
        expect(['ok', 'degraded']).toContain(res.body.data.status);
        expect(res.body.data.check).toBe('readiness');
        expect(res.body.data.services.database.status).toBe('up');
        expect(res.body.data.services.redis).toBeDefined();
      });
  });

  it('/health (GET) should return 200 overall health report', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(['ok', 'degraded']).toContain(res.body.data.status);
        expect(res.body.data.version).toBe('1.0.0');
        expect(res.body.data.services.database.status).toBe('up');
      });
  });
});

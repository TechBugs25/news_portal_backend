import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Editorial Workflow & RBAC Lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let reporterToken: string;
  let categoryId: string;
  let articleId: string;
  let articleSlug: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Admin login
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@newsportal.com',
        password: 'AdminPassword123!',
      });
    adminToken = adminRes.body.data.accessToken;

    // Create a Reporter account via Admin
    const reporterEmail = `reporter_${Date.now()}@newsportal.com`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: reporterEmail,
        password: 'ReporterPassword123!',
        firstName: 'Bob',
        lastName: 'Reporter',
        role: 'REPORTER',
      });

    // Reporter login
    const reporterRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: reporterEmail,
        password: 'ReporterPassword123!',
      });
    reporterToken = reporterRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Admin should create a Category for articles', async () => {
    const catName = `Tech News ${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: catName,
        description: 'Latest in technology and gadgets',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    categoryId = res.body.data.id;
  });

  it('Reporter should create a DRAFT article with tags', async () => {
    const title = `AI Breakthrough in 2026 ${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        title,
        content:
          'Researchers have unveiled groundbreaking advances in agentic AI architectures.',
        summary: 'Major AI breakthrough revealed.',
        categoryId,
        tags: ['AI', 'Tech', 'Innovation'],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.slug).toBeDefined();
    articleId = res.body.data.id;
    articleSlug = res.body.data.slug;
  });

  it('Reporter should submit the article for review (PENDING_REVIEW)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/articles/${articleId}/status`)
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ status: 'PENDING_REVIEW' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING_REVIEW');
  });

  it('Reporter should NOT be allowed to directly publish the article (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .patch(`/articles/${articleId}/status`)
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(403);
  });

  it('Admin should approve and PUBLISH the article', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/articles/${articleId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toBeDefined();
  });

  it('Public reader should retrieve the published article by slug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/articles/${articleSlug}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe(articleSlug);
    expect(res.body.data.status).toBe('PUBLISHED');
  });
});

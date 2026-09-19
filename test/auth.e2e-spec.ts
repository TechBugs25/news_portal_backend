import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Authentication & Security (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  const testUserEmail = `testuser_${Date.now()}@newsportal.com`;
  const testUserPassword = 'StrongPassword123!';
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully log in as the default seeded administrator', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@newsportal.com',
        password: 'AdminPassword123!',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('ADMIN');
    adminToken = res.body.data.accessToken;
  });

  it('should register a new user as READER with Zod validation', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testUserEmail,
        password: testUserPassword,
        firstName: 'Jane',
        lastName: 'Doe',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(testUserEmail);
    expect(res.body.data.user.role).toBe('READER');
    userToken = res.body.data.accessToken;
  });

  it('should reject registration if email is invalid (Zod schema validation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: 'Short',
        firstName: 'J',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('should reject login with wrong password (401 Unauthorized)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@newsportal.com',
        password: 'WrongPassword!',
      })
      .expect(401);
  });

  it('should access protected profile /users/me using Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUserEmail);
  });

  it('should reject accessing /users/me without Bearer token (401 Unauthorized)', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('Admin should be allowed to access /users listing', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('Reader should be forbidden from accessing /users listing (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

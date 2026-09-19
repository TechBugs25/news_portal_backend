import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialNewsPortalSchema1726747200000 implements MigrationInterface {
  name = 'InitialNewsPortalSchema1726747200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('ADMIN', 'CHIEF_EDITOR', 'REPORTER', 'READER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "article_status_enum" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Create Users Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'READER',
        "avatarUrl" varchar(500),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email");
    `);

    // 3. Create Categories Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(150) NOT NULL,
        "slug" varchar(150) NOT NULL,
        "description" text,
        "orderIndex" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "parentId" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_categories_slug" ON "categories" ("slug");
    `);

    // 4. Create Tags Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tags_slug" ON "tags" ("slug");
    `);

    // 5. Create Articles Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "articles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(300) NOT NULL,
        "slug" varchar(350) NOT NULL,
        "excerpt" text,
        "content" text NOT NULL,
        "featuredImageUrl" varchar(500),
        "status" "article_status_enum" NOT NULL DEFAULT 'DRAFT',
        "authorId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reviewerId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "categoryId" uuid NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "scheduledAt" TIMESTAMP WITH TIME ZONE,
        "viewCount" bigint NOT NULL DEFAULT 0,
        "isFeatured" boolean NOT NULL DEFAULT false,
        "isBreaking" boolean NOT NULL DEFAULT false,
        "metaTitle" varchar(255),
        "metaDescription" varchar(500),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_articles_slug" ON "articles" ("slug");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_articles_publishedAt" ON "articles" ("publishedAt");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_articles_isFeatured" ON "articles" ("isFeatured");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_articles_isBreaking" ON "articles" ("isBreaking");
    `);

    // 6. Create Article Tags Join Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "article_tags" (
        "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
        "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
        PRIMARY KEY ("article_id", "tag_id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_article_tags_article_id" ON "article_tags" ("article_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_article_tags_tag_id" ON "article_tags" ("tag_id");
    `);

    // 7. Create Media Assets Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "filename" varchar(255) NOT NULL,
        "originalName" varchar(255) NOT NULL,
        "mimeType" varchar(100) NOT NULL,
        "sizeBytes" bigint NOT NULL,
        "url" varchar(500) NOT NULL,
        "storagePath" varchar(500) NOT NULL,
        "caption" varchar(300),
        "uploaderId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "media_assets" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "article_tags" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "articles" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tags" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "article_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum";`);
  }
}

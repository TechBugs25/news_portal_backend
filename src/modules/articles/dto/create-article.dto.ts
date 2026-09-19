import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ArticleStatus } from '../../../common/enums/article-status.enum';

export const createArticleSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1, { message: 'Content is required' }),
  featuredImageUrl: z.url().optional().or(z.literal('')),
  categoryId: z.uuid({ message: 'Category ID must be a valid UUID' }),
  tags: z.array(z.string()).optional(),
  status: z.enum(ArticleStatus).optional(),
  isFeatured: z.boolean().optional(),
  isBreaking: z.boolean().optional(),
  scheduledAt: z.iso.datetime().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export class CreateArticleDto extends createZodDto(createArticleSchema) {}

export const updateArticleSchema = createArticleSchema.partial();
export class UpdateArticleDto extends createZodDto(updateArticleSchema) {}

export const updateArticleStatusSchema = z.object({
  status: z.enum(ArticleStatus),
});
export class UpdateArticleStatusDto extends createZodDto(
  updateArticleStatusSchema,
) {}

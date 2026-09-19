import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationSchema } from '../../../common/dto/pagination.dto';
import { ArticleStatus } from '../../../common/enums/article-status.enum';

export const queryArticleSchema = paginationSchema.extend({
  categoryId: z
    .uuid({ message: 'Category ID must be a valid UUID' })
    .optional(),
  categorySlug: z.string().optional(),
  tagId: z.uuid({ message: 'Tag ID must be a valid UUID' }).optional(),
  tagSlug: z.string().optional(),
  authorId: z.uuid({ message: 'Author ID must be a valid UUID' }).optional(),
  status: z.enum(ArticleStatus).optional(),
  isFeatured: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .optional(),
  isBreaking: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .optional(),
  search: z.string().optional(),
});

export class QueryArticleDto extends createZodDto(queryArticleSchema) {
  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 10);
  }
}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, { message: 'Category name is required' }),
  slug: z.string().optional(),
  description: z.string().optional(),
  orderIndex: z.number().int().optional(),
  parentId: z.uuid({ message: 'Parent ID must be a valid UUID' }).optional(),
});

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}

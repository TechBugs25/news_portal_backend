import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1, { message: 'Tag name is required' }),
  slug: z.string().optional(),
});

export class CreateTagDto extends createZodDto(createTagSchema) {}

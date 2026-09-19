import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole } from '../../../common/enums/user-role.enum';

export const createUserSchema = z.object({
  email: z.email({ message: 'Must be a valid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  role: z.enum(UserRole).optional(),
  avatarUrl: z.url().optional().or(z.literal('')),
});

export class CreateUserDto extends createZodDto(createUserSchema) {}

export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export class UpdateUserDto extends createZodDto(updateUserSchema) {}

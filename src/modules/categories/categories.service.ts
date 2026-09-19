import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  private readonly CACHE_KEY = 'categories:tree';

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly redisService: RedisService,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = createCategoryDto.slug
      ? this.generateSlug(createCategoryDto.slug)
      : this.generateSlug(createCategoryDto.name);

    const existing = await this.categoryRepository.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(
        `Category with slug "${slug}" already exists`,
      );
    }

    let parent: Category | undefined;
    if (createCategoryDto.parentId) {
      const foundParent = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });
      if (!foundParent) {
        throw new NotFoundException(`Parent category not found`);
      }
      parent = foundParent;
    }

    const category = this.categoryRepository.create({
      name: createCategoryDto.name,
      slug,
      description: createCategoryDto.description,
      orderIndex: createCategoryDto.orderIndex ?? 0,
      parent,
    });

    const saved = await this.categoryRepository.save(category);
    await this.redisService.del(this.CACHE_KEY);
    return saved;
  }

  async findAllTree(): Promise<Category[]> {
    const cached = await this.redisService.get<Category[]>(this.CACHE_KEY);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      relations: ['children', 'parent'],
      order: { orderIndex: 'ASC', name: 'ASC' },
    });

    // Return root categories with children nested
    const rootCategories = categories.filter((c) => !c.parent);
    await this.redisService.set(this.CACHE_KEY, rootCategories, 600);
    return rootCategories;
  }

  async findOne(idOrSlug: string): Promise<Category> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    const category = await this.categoryRepository.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      relations: ['children', 'parent'],
    });

    if (!category) {
      throw new NotFoundException(`Category "${idOrSlug}" not found`);
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    if (updateCategoryDto.slug) {
      category.slug = this.generateSlug(updateCategoryDto.slug);
    } else if (updateCategoryDto.name && !updateCategoryDto.slug) {
      category.slug = this.generateSlug(updateCategoryDto.name);
    }

    if (updateCategoryDto.parentId !== undefined) {
      if (updateCategoryDto.parentId === null) {
        category.parent = undefined;
      } else {
        const parent = await this.categoryRepository.findOne({
          where: { id: updateCategoryDto.parentId },
        });
        if (!parent) {
          throw new NotFoundException('Parent category not found');
        }
        category.parent = parent;
      }
    }

    Object.assign(category, {
      name: updateCategoryDto.name ?? category.name,
      description: updateCategoryDto.description ?? category.description,
      orderIndex: updateCategoryDto.orderIndex ?? category.orderIndex,
      isActive: updateCategoryDto.isActive ?? category.isActive,
    });

    const saved = await this.categoryRepository.save(category);
    await this.redisService.del(this.CACHE_KEY);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    await this.redisService.del(this.CACHE_KEY);
  }
}

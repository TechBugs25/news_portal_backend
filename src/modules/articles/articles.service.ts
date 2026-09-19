import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { ArticleStatus } from '../../common/enums/article-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CategoriesService } from '../categories/categories.service';
import { RedisService } from '../redis/redis.service';
import { TagsService } from '../tags/tags.service';
import { User } from '../users/entities/user.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import {
  UpdateArticleDto,
  UpdateArticleStatusDto,
} from './dto/update-article.dto';
import { Article } from './entities/article.entity';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly redisService: RedisService,
  ) {}

  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = Math.random().toString(36).substring(2, 7);
    return `${base}-${suffix}`;
  }

  async create(
    createArticleDto: CreateArticleDto,
    author: User,
  ): Promise<Article> {
    // If user is a reporter, they cannot directly publish
    if (
      author.role === UserRole.REPORTER &&
      createArticleDto.status === ArticleStatus.PUBLISHED
    ) {
      throw new ForbiddenException(
        'Reporters cannot directly publish articles. Please submit for review.',
      );
    }

    const category = await this.categoriesService.findOne(
      createArticleDto.categoryId,
    );
    const tags = createArticleDto.tags
      ? await this.tagsService.findOrCreateMany(createArticleDto.tags)
      : [];

    const slug = createArticleDto.slug
      ? createArticleDto.slug
      : this.generateSlug(createArticleDto.title);

    const existingSlug = await this.articleRepository.findOne({
      where: { slug },
    });
    if (existingSlug) {
      throw new BadRequestException(
        `Article with slug "${slug}" already exists`,
      );
    }

    const initialStatus = createArticleDto.status ?? ArticleStatus.DRAFT;
    const publishedAt =
      initialStatus === ArticleStatus.PUBLISHED ? new Date() : undefined;

    const article = this.articleRepository.create({
      ...createArticleDto,
      slug,
      author,
      category,
      tags,
      status: initialStatus,
      publishedAt,
      scheduledAt: createArticleDto.scheduledAt
        ? new Date(createArticleDto.scheduledAt)
        : undefined,
    });

    const saved = await this.articleRepository.save(article);
    await this.invalidateArticleCaches();
    return saved;
  }

  async findAllPublic(
    query: QueryArticleDto,
  ): Promise<PaginatedResult<Article>> {
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('article.status = :status', { status: ArticleStatus.PUBLISHED })
      .andWhere(
        '(article.publishedAt IS NULL OR article.publishedAt <= :now)',
        { now: new Date() },
      );

    if (query.categoryId) {
      qb.andWhere('category.id = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.categorySlug) {
      qb.andWhere('category.slug = :categorySlug', {
        categorySlug: query.categorySlug,
      });
    }
    if (query.tagId) {
      qb.andWhere('tags.id = :tagId', { tagId: query.tagId });
    }
    if (query.tagSlug) {
      qb.andWhere('tags.slug = :tagSlug', { tagSlug: query.tagSlug });
    }
    if (query.authorId) {
      qb.andWhere('author.id = :authorId', { authorId: query.authorId });
    }
    if (query.isFeatured !== undefined) {
      qb.andWhere('article.isFeatured = :isFeatured', {
        isFeatured: query.isFeatured,
      });
    }
    if (query.isBreaking !== undefined) {
      qb.andWhere('article.isBreaking = :isBreaking', {
        isBreaking: query.isBreaking,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(article.title ILIKE :search OR article.excerpt ILIKE :search OR article.content ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('article.publishedAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async findBreakingNews(limit = 5): Promise<Article[]> {
    const cacheKey = `articles:breaking:${limit}`;
    const cached = await this.redisService.get<Article[]>(cacheKey);
    if (cached) return cached;

    const articles = await this.articleRepository.find({
      where: {
        status: ArticleStatus.PUBLISHED,
        isBreaking: true,
      },
      order: { publishedAt: 'DESC' },
      take: limit,
      relations: ['category', 'author'],
    });

    await this.redisService.set(cacheKey, articles, 60); // 1 minute cache
    return articles;
  }

  async findFeaturedNews(limit = 6): Promise<Article[]> {
    const cacheKey = `articles:featured:${limit}`;
    const cached = await this.redisService.get<Article[]>(cacheKey);
    if (cached) return cached;

    const articles = await this.articleRepository.find({
      where: {
        status: ArticleStatus.PUBLISHED,
        isFeatured: true,
      },
      order: { publishedAt: 'DESC' },
      take: limit,
      relations: ['category', 'author', 'tags'],
    });

    await this.redisService.set(cacheKey, articles, 120); // 2 minutes cache
    return articles;
  }

  async findOneBySlugOrId(idOrSlug: string, isPublic = true): Promise<Article> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.reviewer', 'reviewer')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags');

    if (isUuid) {
      qb.where('article.id = :idOrSlug', { idOrSlug });
    } else {
      qb.where('article.slug = :idOrSlug', { idOrSlug });
    }

    if (isPublic) {
      qb.andWhere('article.status = :status', {
        status: ArticleStatus.PUBLISHED,
      });
    }

    const article = await qb.getOne();
    if (!article) {
      throw new NotFoundException(`Article "${idOrSlug}" not found`);
    }

    if (isPublic) {
      // Asynchronously increment view count without blocking response
      this.articleRepository
        .increment({ id: article.id }, 'viewCount', 1)
        .catch(() => {});
    }

    return article;
  }

  async findAllAdmin(
    query: QueryArticleDto,
    user: User,
  ): Promise<PaginatedResult<Article>> {
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.reviewer', 'reviewer')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags');

    // If reporter, only show their own articles unless querying public
    if (user.role === UserRole.REPORTER) {
      qb.andWhere('author.id = :userId', { userId: user.id });
    }

    if (query.status) {
      qb.andWhere('article.status = :status', { status: query.status });
    }
    if (query.categoryId) {
      qb.andWhere('category.id = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(article.title ILIKE :search OR article.excerpt ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('article.createdAt', 'DESC').skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async update(
    id: string,
    updateDto: UpdateArticleDto,
    user: User,
  ): Promise<Article> {
    const article = await this.findOneBySlugOrId(id, false);

    if (user.role === UserRole.REPORTER && article.author.id !== user.id) {
      throw new ForbiddenException(
        'Reporters can only edit their own articles',
      );
    }

    if (updateDto.categoryId) {
      article.category = await this.categoriesService.findOne(
        updateDto.categoryId,
      );
    }
    if (updateDto.tags) {
      article.tags = await this.tagsService.findOrCreateMany(updateDto.tags);
    }

    Object.assign(article, {
      title: updateDto.title ?? article.title,
      slug: updateDto.slug ?? article.slug,
      excerpt: updateDto.excerpt ?? article.excerpt,
      content: updateDto.content ?? article.content,
      featuredImageUrl: updateDto.featuredImageUrl ?? article.featuredImageUrl,
      isFeatured: updateDto.isFeatured ?? article.isFeatured,
      isBreaking: updateDto.isBreaking ?? article.isBreaking,
      metaTitle: updateDto.metaTitle ?? article.metaTitle,
      metaDescription: updateDto.metaDescription ?? article.metaDescription,
      scheduledAt: updateDto.scheduledAt
        ? new Date(updateDto.scheduledAt)
        : article.scheduledAt,
    });

    const saved = await this.articleRepository.save(article);
    await this.invalidateArticleCaches();
    return saved;
  }

  async updateStatus(
    id: string,
    statusDto: UpdateArticleStatusDto,
    reviewer: User,
  ): Promise<Article> {
    const article = await this.findOneBySlugOrId(id, false);

    // Reporters can only submit to PENDING_REVIEW or back to DRAFT
    if (reviewer.role === UserRole.REPORTER) {
      if (
        statusDto.status !== ArticleStatus.DRAFT &&
        statusDto.status !== ArticleStatus.PENDING_REVIEW
      ) {
        throw new ForbiddenException(
          'Reporters can only set status to DRAFT or PENDING_REVIEW',
        );
      }
    }

    article.status = statusDto.status;
    if (statusDto.status === ArticleStatus.PUBLISHED) {
      article.reviewer = reviewer;
      if (!article.publishedAt) {
        article.publishedAt = new Date();
      }
    }

    const saved = await this.articleRepository.save(article);
    await this.invalidateArticleCaches();
    return saved;
  }

  async remove(id: string, user: User): Promise<void> {
    const article = await this.findOneBySlugOrId(id, false);
    if (user.role === UserRole.REPORTER && article.author.id !== user.id) {
      throw new ForbiddenException(
        'Reporters can only delete their own draft articles',
      );
    }

    await this.articleRepository.remove(article);
    await this.invalidateArticleCaches();
  }

  private async invalidateArticleCaches(): Promise<void> {
    await this.redisService.del('articles:*');
  }
}

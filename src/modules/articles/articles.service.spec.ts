import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticleStatus } from '../../common/enums/article-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CategoriesService } from '../categories/categories.service';
import { RedisService } from '../redis/redis.service';
import { TagsService } from '../tags/tags.service';
import { User } from '../users/entities/user.entity';
import { ArticlesService } from './articles.service';
import { Article } from './entities/article.entity';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let articleRepoMock: any;
  let categoriesServiceMock: any;
  let tagsServiceMock: any;
  let redisServiceMock: any;

  beforeEach(async () => {
    articleRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((art) =>
          Promise.resolve({ id: 'art-uuid-1', ...art }),
        ),
      createQueryBuilder: jest.fn(),
    };

    categoriesServiceMock = {
      findOne: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Tech' }),
    };

    tagsServiceMock = {
      findOrCreateMany: jest
        .fn()
        .mockResolvedValue([{ id: 'tag-1', name: 'AI' }]),
    };

    redisServiceMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: articleRepoMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
        { provide: TagsService, useValue: tagsServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  it('should prevent a reporter from directly publishing an article', async () => {
    const reporter: User = {
      id: 'rep-1',
      email: 'reporter@news.com',
      passwordHash: 'hash',
      firstName: 'Jane',
      lastName: 'Reporter',
      role: UserRole.REPORTER,
      isActive: true,
      articles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(
      service.create(
        {
          title: 'Direct Publish Attempt',
          content: 'Content',
          categoryId: 'cat-1',
          status: ArticleStatus.PUBLISHED,
        },
        reporter,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow reporter to save draft and generate slug', async () => {
    const reporter: User = {
      id: 'rep-1',
      email: 'reporter@news.com',
      passwordHash: 'hash',
      firstName: 'Jane',
      lastName: 'Reporter',
      role: UserRole.REPORTER,
      isActive: true,
      articles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    articleRepoMock.findOne.mockResolvedValue(null);

    const result = await service.create(
      {
        title: 'New Solar Panel Efficiency Record',
        content: 'Article content here...',
        categoryId: 'cat-1',
        tags: ['Energy'],
        status: ArticleStatus.DRAFT,
      },
      reporter,
    );

    expect(result.status).toBe(ArticleStatus.DRAFT);
    expect(result.slug).toContain('new-solar-panel-efficiency-record');
    expect(articleRepoMock.save).toHaveBeenCalled();
    expect(redisServiceMock.del).toHaveBeenCalledWith('articles:*');
  });
});

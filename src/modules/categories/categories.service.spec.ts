import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repoMock: any;
  let redisMock: any;

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((category) =>
          Promise.resolve({ id: 'cat-uuid-1', ...category }),
        ),
      remove: jest.fn(),
    };

    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: repoMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a category with auto-generated slug', async () => {
    repoMock.findOne.mockResolvedValue(null);

    const result = await service.create({
      name: 'World News & Politics',
      description: 'Global updates',
    });

    expect(result.slug).toBe('world-news-politics');
    expect(repoMock.save).toHaveBeenCalled();
    expect(redisMock.del).toHaveBeenCalled();
  });

  it('should throw BadRequestException if category slug already exists', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'existing-id', slug: 'politics' });

    await expect(
      service.create({ name: 'Politics', slug: 'politics' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return cached tree if available', async () => {
    const cachedTree = [{ id: '1', name: 'Cached Tech' }];
    redisMock.get.mockResolvedValue(cachedTree);

    const result = await service.findAllTree();
    expect(result).toEqual(cachedTree);
    expect(repoMock.find).not.toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let dataSourceMock: { isInitialized: boolean; query: jest.Mock };
  let redisServiceMock: { ping: jest.Mock };

  beforeEach(async () => {
    dataSourceMock = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    redisServiceMock = {
      ping: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLiveness', () => {
    it('should return liveness response with status ok and memory details', () => {
      const result = service.getLiveness();
      expect(result.status).toBe('ok');
      expect(result.check).toBe('liveness');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(result.memoryUsage).toBeDefined();
      expect(result.memoryUsage.heapUsedMb).toBeGreaterThan(0);
    });
  });

  describe('getReadiness', () => {
    it('should return status ok when both database and redis are up', async () => {
      const result = await service.getReadiness();
      expect(result.status).toBe('ok');
      expect(result.check).toBe('readiness');
      expect(result.services.database.status).toBe('up');
      expect(result.services.redis.status).toBe('up');
    });

    it('should return status error when database is down', async () => {
      dataSourceMock.query.mockRejectedValueOnce(
        new Error('Connection terminated'),
      );
      const result = await service.getReadiness();
      expect(result.status).toBe('error');
      expect(result.services.database.status).toBe('down');
      expect(result.services.database.error).toBe('Connection terminated');
    });

    it('should return status degraded when database is up but redis is down', async () => {
      redisServiceMock.ping.mockResolvedValueOnce({
        status: 'down',
        error: 'Redis ECONNREFUSED',
      });
      const result = await service.getReadiness();
      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('up');
      expect(result.services.redis.status).toBe('down');
    });
  });

  describe('getOverallHealth', () => {
    it('should return overall health including version and uptime', async () => {
      const result = await service.getOverallHealth();
      expect(result.status).toBe('ok');
      expect(result.version).toBe('1.0.0');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(typeof result.nodeVersion).toBe('string');
    });
  });
});

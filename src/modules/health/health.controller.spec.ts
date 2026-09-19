/* eslint-disable @typescript-eslint/unbound-method */
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthServiceMock: {
    getLiveness: jest.Mock;
    getReadiness: jest.Mock;
    getOverallHealth: jest.Mock;
  };

  const createMockResponse = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    healthServiceMock = {
      getLiveness: jest.fn().mockReturnValue({
        status: 'ok',
        check: 'liveness',
        timestamp: new Date().toISOString(),
        uptimeSeconds: 10,
        memoryUsage: { rssMb: 50, heapTotalMb: 30, heapUsedMb: 20 },
      }),
      getReadiness: jest.fn().mockResolvedValue({
        status: 'ok',
        check: 'readiness',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'up', type: 'postgres-18', latencyMs: 2 },
          redis: { status: 'up', type: 'redis-7', latencyMs: 1 },
        },
      }),
      getOverallHealth: jest.fn().mockResolvedValue({
        status: 'ok',
        check: 'readiness',
        timestamp: new Date().toISOString(),
        uptimeSeconds: 10,
        version: '1.0.0',
        nodeVersion: 'v20.0.0',
        services: {
          database: { status: 'up', type: 'postgres-18', latencyMs: 2 },
          redis: { status: 'up', type: 'redis-7', latencyMs: 1 },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthServiceMock }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLiveness', () => {
    it('should return liveness result directly', () => {
      const result = controller.getLiveness();
      expect(result.status).toBe('ok');
      expect(healthServiceMock.getLiveness).toHaveBeenCalled();
    });
  });

  describe('getReadiness', () => {
    it('should return readiness result and not set 503 if status is ok', async () => {
      const mockRes = createMockResponse();
      const result = await controller.getReadiness(mockRes);
      expect(result.status).toBe('ok');
      expect(mockRes.status).not.toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });

    it('should set 503 SERVICE_UNAVAILABLE if status is error', async () => {
      healthServiceMock.getReadiness.mockResolvedValueOnce({
        status: 'error',
        check: 'readiness',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'down',
            type: 'postgres-18',
            error: 'Connection lost',
          },
          redis: { status: 'up', type: 'redis-7', latencyMs: 1 },
        },
      });

      const mockRes = createMockResponse();
      const result = await controller.getReadiness(mockRes);
      expect(result.status).toBe('error');
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });

  describe('getHealth', () => {
    it('should return overall health and not set 503 if status is ok', async () => {
      const mockRes = createMockResponse();
      const result = await controller.getHealth(mockRes);
      expect(result.status).toBe('ok');
      expect(mockRes.status).not.toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });
});

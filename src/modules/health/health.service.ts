import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

export interface ServiceCheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
  type: string;
}

export interface LivenessResponse {
  status: 'ok';
  check: 'liveness';
  timestamp: string;
  uptimeSeconds: number;
  memoryUsage: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
}

export interface ReadinessResponse {
  status: 'ok' | 'degraded' | 'error';
  check: 'readiness';
  timestamp: string;
  services: {
    database: ServiceCheckResult;
    redis: ServiceCheckResult;
  };
}

export interface OverallHealthResponse extends ReadinessResponse {
  uptimeSeconds: number;
  version: string;
  nodeVersion: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  getLiveness(): LivenessResponse {
    const memory = process.memoryUsage();
    return {
      status: 'ok',
      check: 'liveness',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      },
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    let status: 'ok' | 'degraded' | 'error' = 'ok';
    if (database.status === 'down') {
      status = 'error';
    } else if (redis.status === 'down') {
      status = 'degraded';
    }

    return {
      status,
      check: 'readiness',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };
  }

  async getOverallHealth(): Promise<OverallHealthResponse> {
    const readiness = await this.getReadiness();
    return {
      ...readiness,
      uptimeSeconds: Math.floor(process.uptime()),
      version: '1.0.0',
      nodeVersion: process.version,
    };
  }

  private async checkDatabase(): Promise<ServiceCheckResult> {
    const start = Date.now();
    try {
      if (!this.dataSource.isInitialized) {
        return {
          status: 'down',
          type: 'postgres-18',
          error: 'DataSource is not initialized',
        };
      }
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return {
        status: 'up',
        type: 'postgres-18',
        latencyMs,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Database health check failed: ${err.message}`);
      return {
        status: 'down',
        type: 'postgres-18',
        error: err.message,
      };
    }
  }

  private async checkRedis(): Promise<ServiceCheckResult> {
    const redisPing = await this.redisService.ping();
    return {
      status: redisPing.status,
      type: 'redis-7',
      latencyMs: redisPing.latencyMs,
      error: redisPing.error,
    };
  }
}

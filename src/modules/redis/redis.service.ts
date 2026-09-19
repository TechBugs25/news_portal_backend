import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvConfig } from '../../config/env.validation';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');

    try {
      this.client = new Redis({
        host,
        port,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(
              'Redis unavailable. Continuing without cache layer.',
            );
            return null; // Stop retrying if unavailable
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.client
        .connect()
        .then(() => {
          this.isConnected = true;
          this.logger.log(`Connected to Redis at ${host}:${port}`);
        })
        .catch((err: unknown) => {
          const error = err as Error;
          this.logger.warn(
            `Redis connection failed (${error.message}). Fallback to in-memory/direct queries.`,
          );
          this.isConnected = false;
        });

      this.client.on('error', (err: unknown) => {
        const error = err as Error;
        this.logger.warn(`Redis error: ${error.message}`);
        this.isConnected = false;
      });
    } catch (e: unknown) {
      const err = e as Error;
      this.logger.warn(`Failed to initialize Redis client: ${err.message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      this.logger.warn(
        `Redis get failed for key "${key}": ${(error as Error).message}`,
      );
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const serialized = JSON.stringify(value);
      const ttl =
        ttlSeconds ?? this.configService.get<number>('REDIS_TTL_SECONDS');
      await this.client.setex(key, ttl, serialized);
    } catch (error) {
      this.logger.warn(
        `Redis set failed for key "${key}": ${(error as Error).message}`,
      );
    }
  }

  async del(patternOrKey: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      if (patternOrKey.includes('*')) {
        const keys = await this.client.keys(patternOrKey);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } else {
        await this.client.del(patternOrKey);
      }
    } catch (error) {
      this.logger.warn(
        `Redis del failed for "${patternOrKey}": ${(error as Error).message}`,
      );
    }
  }

  async ping(): Promise<{
    status: 'up' | 'down';
    latencyMs?: number;
    error?: string;
  }> {
    if (!this.isConnected || !this.client) {
      return { status: 'down', error: 'Redis client is not connected' };
    }
    const start = Date.now();
    try {
      const result = await this.client.ping();
      const latencyMs = Date.now() - start;
      if (result === 'PONG') {
        return { status: 'up', latencyMs };
      }
      return { status: 'down', error: 'Unexpected Redis ping response' };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

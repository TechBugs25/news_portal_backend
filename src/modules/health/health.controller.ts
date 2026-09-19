import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';
import type {
  LivenessResponse,
  OverallHealthResponse,
  ReadinessResponse,
} from './health.service';

@ApiTags('Health & Monitoring')
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Overall system health overview' })
  @ApiResponse({
    status: 200,
    description: 'System health report including database and cache status',
  })
  @ApiResponse({
    status: 503,
    description: 'System is degraded or critical dependencies are down',
  })
  async getHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<OverallHealthResponse> {
    const health = await this.healthService.getOverallHealth();
    if (health.status === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Get(['live', 'liveness'])
  @ApiOperation({
    summary: 'Liveness probe (Kubernetes / Docker healthcheck)',
    description:
      'Checks if the application process is running and responsive. Used to restart failing containers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application process is alive',
  })
  getLiveness(): LivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get(['ready', 'readiness'])
  @ApiOperation({
    summary: 'Readiness probe (Kubernetes / Load Balancer routing)',
    description:
      'Checks if the application is ready to accept user traffic by verifying PostgreSQL 18 and Redis 7 connectivity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready to receive requests',
  })
  @ApiResponse({
    status: 503,
    description:
      'Application is not ready. Critical downstream dependencies (PostgreSQL 18) are unreachable.',
  })
  async getReadiness(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReadinessResponse> {
    const readiness = await this.healthService.getReadiness();
    if (readiness.status === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return readiness;
  }
}

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { DataSource } from 'typeorm';
import { EnvConfig, validateEnv } from './env.validation';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

export const getTypeOrmConfig = (
  configService: ConfigService<EnvConfig, true>,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  autoLoadEntities: true,
  synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
  logging: configService.get('DB_LOGGING') === 'true',
  ssl: false,
});

// DataSource for TypeORM CLI / Migrations validated through Zod schema
const cliEnv = validateEnv(process.env);

export const connectionSource = new DataSource({
  type: 'postgres',
  host: cliEnv.DB_HOST,
  port: cliEnv.DB_PORT,
  username: cliEnv.DB_USERNAME,
  password: cliEnv.DB_PASSWORD,
  database: cliEnv.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
});

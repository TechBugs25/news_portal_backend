import { validateEnv } from './env.validation';

describe('validateEnv (Zod)', () => {
  it('should validate and parse valid environment configuration with defaults', () => {
    const config = {
      DB_HOST: 'localhost',
      PORT: '4000',
    };

    const parsed = validateEnv(config);
    expect(parsed.PORT).toBe(4000);
    expect(parsed.DB_HOST).toBe('localhost');
    expect(parsed.DB_DATABASE).toBe('news_portal_db');
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('should throw Error if invalid enum value is provided', () => {
    const config = {
      NODE_ENV: 'invalid_env_mode',
    };

    expect(() => validateEnv(config)).toThrow(/Environment validation failed/);
  });
});

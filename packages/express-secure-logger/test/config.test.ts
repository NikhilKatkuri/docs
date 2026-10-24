import { describe, expect, it } from 'vitest';
import { LoggerConfigError, loadLoggerConfig } from '../src';

describe('loadLoggerConfig', () => {
  it('applies safe defaults per environment', () => {
    expect(loadLoggerConfig({ NODE_ENV: 'production' })).toMatchObject({ level: 'info', pretty: false, ipMode: 'full', geo: { enabled: false } });
    expect(loadLoggerConfig({ NODE_ENV: 'development' })).toMatchObject({ level: 'debug', pretty: true });
    expect(loadLoggerConfig({ NODE_ENV: 'test' }).level).toBe('silent');
    expect(loadLoggerConfig({}).environment).toBe('development');
  });
  it('parses overrides', () => {
    const c = loadLoggerConfig({
      NODE_ENV: 'production', LOG_LEVEL: 'WARN', APP_NAME: 'api', LOG_IP_MODE: 'anonymized', LOG_GEO_ENABLED: 'true',
      LOG_GEO_CACHE_SIZE: '10', LOG_QUIET_PATHS: '/a, /b', LOG_IGNORE_PATHS: '/ping', LOG_QUERY_ALLOWLIST: 'page,limit', SERVICE_VERSION: '1.2.3',
    });
    expect(c).toMatchObject({ level: 'warn', appName: 'api', ipMode: 'anonymized', quietPaths: ['/a', '/b'], ignorePaths: ['/ping'], queryAllowlist: ['page', 'limit'], serviceVersion: '1.2.3' });
    expect(c.geo).toMatchObject({ enabled: true, cacheSize: 10 });
  });
  it('fails clearly, listing every problem without echoing values', () => {
    try {
      loadLoggerConfig({ LOG_LEVEL: 'verbose-SECRETISH', LOG_GEO_ENABLED: 'maybe', LOG_IP_MODE: 'x', APP_NAME: 'bad name!' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LoggerConfigError);
      const msg = (e as Error).message;
      expect(msg).toContain('LOG_LEVEL');
      expect(msg).toContain('LOG_GEO_ENABLED');
      expect(msg).toContain('LOG_IP_MODE');
      expect(msg).toContain('APP_NAME');
      expect(msg).not.toContain('SECRETISH');
    }
  });
});

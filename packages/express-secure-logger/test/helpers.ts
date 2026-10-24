import { Writable } from 'node:stream';
import { createLogger, loadLoggerConfig, type LoggerConfig } from '../src';

export const SYNTH = {
  bearer: 'SYNTH-BEARER-TOKEN-abc123',
  cookie: 'SYNTH-SESSION-COOKIE-xyz789',
  password: 'SYNTH-PASSWORD-hunter2',
  queryToken: 'SYNTH-QUERY-TOKEN-555',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aCJ9.c3ludGhzaWc',
  apiKey: 'SYNTH-API-KEY-qqq',
};
export const SYNTH_VALUES = Object.values(SYNTH);

export interface Capture {
  logger: ReturnType<typeof createLogger>;
  config: LoggerConfig;
  lines: string[];
  records: () => Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  text: () => string;
}

export function captureLogger(overrides: Partial<LoggerConfig> = {}, env: Record<string, string> = {}): Capture {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      cb();
    },
  });
  const config = { ...loadLoggerConfig({ NODE_ENV: 'production', LOG_LEVEL: 'trace', APP_NAME: 'test-app', ...env }), ...overrides };
  const logger = createLogger(config, stream);
  return {
    logger,
    config,
    lines,
    records: () => lines.map((l) => JSON.parse(l)),
    text: () => lines.join('\n'),
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await sleep(5);
  }
}

export function expectNoSecrets(text: string): void {
  for (const v of SYNTH_VALUES) {
    if (text.includes(v)) throw new Error(`Sensitive synthetic value leaked into logs: ${v}`);
  }
}

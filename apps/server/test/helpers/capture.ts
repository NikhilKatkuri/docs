import { Writable } from 'node:stream';
import {
    createLogger,
    loadLoggerConfig,
    type LoggerConfig,
} from 'express-secure-logger';

export const SYNTH = {
    token: 'SYNTH-TOKEN-abc123',
    password: 'SYNTH-PASSWORD-hunter2',
    cookie: 'SYNTH-SESSION-COOKIE-xyz789',
    query: 'SYNTH-QUERY-TOKEN-555',
};

export interface Capture {
    logger: ReturnType<typeof createLogger>;
    config: LoggerConfig;
    lines: string[];
    records: () => Array<Record<string, any>>;
    text: () => string;
}

export function captureLogger(env: Record<string, string> = {}): Capture {
    const lines: string[] = [];
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            lines.push(
                ...chunk
                    .toString()
                    .split('\n')
                    .filter((line: string) => line.length > 0)
            );
            callback();
        },
    });
    const config = loadLoggerConfig({
        NODE_ENV: 'production',
        LOG_LEVEL: 'trace',
        LOG_PRETTY: 'false',
        LOG_IP_MODE: 'none',
        APP_NAME: 'docs-server-test',
        ...env,
    });
    const logger = createLogger(config, stream);

    return {
        logger,
        config,
        lines,
        records: () =>
            lines.map((line) => JSON.parse(line) as Record<string, any>),
        text: () => lines.join('\n'),
    };
}

export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(
    condition: () => boolean,
    timeoutMs = 2_000
): Promise<void> {
    const started = Date.now();
    while (!condition()) {
        if (Date.now() - started > timeoutMs) {
            throw new Error('waitFor timed out');
        }
        await sleep(5);
    }
}

export function expectNoSecrets(text: string): void {
    for (const value of Object.values(SYNTH)) {
        if (text.includes(value)) {
            throw new Error(
                `Sensitive synthetic value leaked into logs: ${value}`
            );
        }
    }
}

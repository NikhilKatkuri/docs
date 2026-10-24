import type { EventEmitter } from 'node:events';
import { flushLogger } from './logger';
import type { AppLogger } from './types';

export interface ProcessHandlerOptions {
  /** HTTP server to stop accepting connections on during shutdown. */
  server?: { close(cb?: (err?: Error) => void): unknown; closeIdleConnections?: () => void };
  /** Extra async cleanup (close DB pools, etc.) run after the server stops. */
  onShutdown?: () => Promise<void> | void;
  signals?: NodeJS.Signals[];
  /** Hard deadline for graceful shutdown. Default 10s. */
  timeoutMs?: number;
  /** Injectable for tests. Default `process.exit`. */
  exit?: (code: number) => void;
  /** Injectable for tests. Default `process`. */
  target?: EventEmitter;
}

/**
 * Installs fatal-error and signal handlers that log, flush the log destination
 * and then exit. Returns an `uninstall` function.
 */
export function installProcessHandlers(logger: AppLogger, options: ProcessHandlerOptions = {}): () => void {
  const target = options.target ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const signals = options.signals ?? ['SIGTERM', 'SIGINT'];
  let shuttingDown = false;

  const finish = async (code: number): Promise<void> => {
    await flushLogger(logger);
    exit(code);
  };

  const onFatal = (kind: string) => (reason: unknown) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      logger.fatal({ err: reason, event: kind }, kind);
    } catch {
      /* ignore */
    }
    void finish(1);
  };
  const uncaught = onFatal('uncaught exception');
  const unhandled = onFatal('unhandled promise rejection');

  const onSignal = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ event: 'shutdown', signal }, 'shutdown signal received');
    const force = setTimeout(() => {
      logger.error({ event: 'shutdown' }, 'graceful shutdown timed out; forcing exit');
      void finish(1);
    }, timeoutMs);
    force.unref?.();
    void (async () => {
      try {
        if (options.server) {
          await new Promise<void>((resolve) => {
            options.server?.close(() => resolve());
            options.server?.closeIdleConnections?.();
          });
        }
        await options.onShutdown?.();
        clearTimeout(force);
        logger.info({ event: 'shutdown' }, 'shutdown complete');
        await finish(0);
      } catch (err) {
        clearTimeout(force);
        logger.error({ err, event: 'shutdown' }, 'error during shutdown');
        await finish(1);
      }
    })();
  };

  target.on('uncaughtException', uncaught);
  target.on('unhandledRejection', unhandled);
  const handlers = signals.map((s) => {
    const h = () => onSignal(s);
    target.on(s, h);
    return [s, h] as const;
  });

  return () => {
    target.off('uncaughtException', uncaught);
    target.off('unhandledRejection', unhandled);
    for (const [s, h] of handlers) target.off(s, h);
  };
}

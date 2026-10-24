import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppLogger } from './types';

interface RequestContext {
  requestId: string;
  log: AppLogger;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Request-scoped logger for services that don't receive `req`; falls back to `fallback` outside a request. */
export function getLogger(fallback: AppLogger): AppLogger {
  return storage.getStore()?.log ?? fallback;
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

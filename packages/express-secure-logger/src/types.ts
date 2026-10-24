import type { Logger } from 'pino';

export type AppLogger = Logger;

/** Final classification of a request, logged as `outcome`. */
export type RequestOutcome =
  | 'success'
  | 'client_error'
  | 'server_error'
  | 'timeout'
  | 'aborted'
  | 'response_error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation ID assigned by the request-logging middleware. */
      id: string;
      /** Child logger bound to this request's `requestId`. */
      log: Logger;
    }
  }
}

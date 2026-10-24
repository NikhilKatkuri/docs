import { randomUUID } from 'node:crypto';

const VALID_ID = /^[A-Za-z0-9._:-]{8,64}$/;

/**
 * Returns the client-supplied ID only if it is a short, strictly-charset value
 * (prevents log injection and ID flooding); otherwise generates a UUID v4.
 */
export function resolveRequestId(incoming: unknown, trustIncoming: boolean): string {
  if (trustIncoming && typeof incoming === 'string' && VALID_ID.test(incoming)) return incoming;
  return randomUUID();
}

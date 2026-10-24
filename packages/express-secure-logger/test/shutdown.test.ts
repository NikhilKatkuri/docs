import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { installProcessHandlers } from '../src';
import { captureLogger, waitFor } from './helpers';

describe('installProcessHandlers', () => {
  it('logs fatal on uncaught exceptions, flushes, and exits 1 exactly once', async () => {
    const cap = captureLogger();
    const target = new EventEmitter();
    const exit = vi.fn();
    installProcessHandlers(cap.logger, { target, exit });
    target.emit('uncaughtException', new Error('crash'));
    target.emit('unhandledRejection', new Error('second'));
    await waitFor(() => exit.mock.calls.length > 0);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    const fatal = cap.records().filter((r) => r.level === 'fatal');
    expect(fatal).toHaveLength(1);
    expect(fatal[0]!.err.stack).toContain('at ');
  });
  it('shuts down gracefully on SIGTERM: closes server, runs cleanup, exits 0', async () => {
    const cap = captureLogger();
    const target = new EventEmitter();
    const exit = vi.fn();
    const server = { close: vi.fn((cb?: () => void) => cb?.()) };
    const onShutdown = vi.fn();
    installProcessHandlers(cap.logger, { target, exit, server, onShutdown });
    target.emit('SIGTERM');
    await waitFor(() => exit.mock.calls.length > 0);
    expect(server.close).toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });
  it('forces exit(1) when graceful shutdown hangs, and uninstall removes listeners', async () => {
    const cap = captureLogger();
    const target = new EventEmitter();
    const exit = vi.fn();
    const server = { close: vi.fn() }; // never calls back
    const off = installProcessHandlers(cap.logger, { target, exit, server, timeoutMs: 30 });
    target.emit('SIGINT');
    await waitFor(() => exit.mock.calls.length > 0);
    expect(exit).toHaveBeenCalledWith(1);
    off();
    expect(target.listenerCount('SIGINT')).toBe(0);
  });
});

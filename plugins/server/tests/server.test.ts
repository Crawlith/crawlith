import { test, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { startServer } from '../src/index';

vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn((port, host, callback) => {
      if (typeof host === 'function') {
        // Handle case where host is omitted and callback is second arg
        host();
      } else if (callback) {
        callback();
      }
      return {
        on: vi.fn(),
        close: vi.fn((cb) => cb && cb())
      };
    })
  };
  return {
    default: vi.fn(() => mockApp)
  };
});

vi.mock('node:path', () => ({
  default: {
    resolve: vi.fn((p) => p),
    join: vi.fn((...args) => args.join('/'))
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('startServer uses default host 127.0.0.1', async () => {
  const mockApp = express();
  await startServer({
    port: 3000,
    staticPath: './static'
  });

  expect(mockApp.listen).toHaveBeenCalledWith(3000, '127.0.0.1', expect.any(Function));
});

test('startServer uses provided host', async () => {
  const mockApp = express();
  await startServer({
    port: 3000,
    host: '0.0.0.0',
    staticPath: './static'
  });

  expect(mockApp.listen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function));
});

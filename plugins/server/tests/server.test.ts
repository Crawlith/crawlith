import { test, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { startServer } from '../src/index.js';

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((msg) => msg),
    green: vi.fn((msg) => msg),
    yellow: vi.fn((msg) => msg),
    gray: vi.fn((msg) => msg),
    blue: vi.fn((msg) => msg)
  }
}));

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
  const expressMock: any = vi.fn(() => mockApp);
  expressMock.static = vi.fn();
  expressMock.Router = vi.fn(() => ({
    get: vi.fn(),
    use: vi.fn()
  }));
  return {
    default: expressMock
  };
});

vi.mock('node:path', () => ({
  default: {
    resolve: vi.fn((p) => p),
    join: vi.fn((...args) => args.join('/'))
  }
}));

// Mock @crawlith/core to prevent actual DB access and process.exit
vi.mock('@crawlith/core', () => {
  return {
    getDb: vi.fn(() => ({
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ domain: 'test.com', created_at: '2024-01-01' })),
        all: vi.fn(() => [])
      }))
    })),
    closeDb: vi.fn(),
    // Important: Use function expression to support 'new' keyword
    SiteRepository: class {
        constructor() {}
        getSiteById() { return { domain: 'test.com', created_at: '2024-01-01' }; }
    },
    SnapshotRepository: class {
        constructor() {}
        getSnapshot() { return { id: 1, site_id: 1, health_score: 90, node_count: 10 }; }
    },
    PageRepository: class {},
    MetricsRepository: class {}
  };
});

// Mock process.exit to avoid killing the test runner if something slips through
vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`process.exit called with ${code}`);
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('startServer uses default host 127.0.0.1', async () => {
  const mockApp = express();
  await startServer({
    port: 3000,
    staticPath: './static',
    siteId: 1,
    snapshotId: 1
  });

  expect(mockApp.listen).toHaveBeenCalledWith(3000, '127.0.0.1', expect.any(Function));
});

test('startServer uses provided host', async () => {
  const mockApp = express();
  await startServer({
    port: 3000,
    host: '0.0.0.0',
    staticPath: './static',
    siteId: 1,
    snapshotId: 1
  });

  expect(mockApp.listen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function));
});

test('startServer registers API routes', async () => {
  const mockApp = express();
  await startServer({
    port: 3000,
    staticPath: './static',
    siteId: 1,
    snapshotId: 1
  });

  // Verify that app.use('/api', ...) was called
  expect(mockApp.use).toHaveBeenCalledWith('/api', expect.anything());

  // Verify express.Router() was called to create the API router
  expect(express.Router).toHaveBeenCalled();
});

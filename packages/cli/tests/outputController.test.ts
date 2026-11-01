import { test, expect, vi, afterEach } from 'vitest';
import { OutputController } from '../src/output/controller.js';

const originalIsTTY = process.stdout.isTTY;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
});

test('json output still reports errors, on stderr only', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
  const controller = new OutputController({ format: 'json', logLevel: 'normal' } as any);

  controller.handle({ type: 'error', message: 'Error during crawl: disk full' });

  expect(stderr).toHaveBeenCalledWith('Error during crawl: disk full');
  expect(stdout).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
});

test('an error after the progress line ends is not followed by a redrawn progress line', () => {
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  const writes: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => { writes.push(String(chunk)); return true; });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const controller = new OutputController({ format: 'pretty', logLevel: 'normal' } as any);

  controller.handle({ type: 'metrics:start', phase: 'Running core algorithms' });
  expect(writes.some(w => w.includes('phase:Running core algorithms'))).toBe(true);

  controller.finish();
  const afterFinish = writes.length;
  controller.handle({ type: 'error', message: 'Error during crawl: boom' });
  controller.handle({ type: 'metrics:start', phase: 'Computing aggregate stats' });

  expect(writes.slice(afterFinish).some(w => w.includes('phase:'))).toBe(false);
});

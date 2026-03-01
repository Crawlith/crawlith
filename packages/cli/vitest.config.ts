import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@crawlith/core': path.resolve(__dirname, '../core/src/index.ts')
    }
  }
});

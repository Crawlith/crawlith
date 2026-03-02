import { describe, it, expect, vi } from 'vitest';
import { PluginLoader } from '../src/plugin-system/plugin-loader.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Plugin Discovery', () => {
    it('should discover internal plugins', async () => {
        // Since we can't easily mock dynamic imports in a clean way without complex setup,
        // we'll focus on the directory traversal and validation logic.

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawlith-test-'));
        const pluginsDir = path.join(tempDir, 'packages/plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });

        const testPluginDir = path.join(pluginsDir, 'test-plugin');
        fs.mkdirSync(testPluginDir);

        fs.writeFileSync(path.join(testPluginDir, 'package.json'), JSON.stringify({
            name: 'test-plugin',
            version: '1.0.0',
            main: 'index.js'
        }));

        // Mock the import for the loader
        // Note: Real dynamic imports are hard to mock in Vitest for actual file paths.
        // We might need to mock the `import()` or use a different strategy.

        const loader = new PluginLoader();

        // We'll mock tryLoadPlugin to avoid the actual import during this specific test
        const tryLoadSpy = vi.spyOn(loader as any, 'tryLoadPlugin');

        await loader.discover(tempDir);

        expect(tryLoadSpy).toHaveBeenCalledWith(expect.stringContaining('test-plugin'), 'internal');

        fs.rmSync(tempDir, { recursive: true, force: true });
    });
});

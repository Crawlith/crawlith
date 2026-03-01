import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    shims: true,
    noExternal: ['@crawlith/server', '@crawlith/web'],
    banner: {
        js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`
    }
});

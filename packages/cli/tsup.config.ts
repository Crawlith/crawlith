import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    shims: true,
    noExternal: [
        '@crawlith/server',
        '@crawlith/web',
        '@crawlith/plugin-pagerank',
        '@crawlith/plugin-hits',
        '@crawlith/plugin-duplicate-detection',
        '@crawlith/plugin-content-clustering',
        '@crawlith/plugin-simhash',
        '@crawlith/plugin-heading-health',
    ],
    banner: {
        js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`
    }
});

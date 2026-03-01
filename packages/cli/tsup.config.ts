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
        '@crawlith/plugin-orphan-intelligence',
        '@crawlith/plugin-soft404-detector',
        '@crawlith/plugin-crawl-trap-analyzer',
        '@crawlith/plugin-health-score-engine',
        '@crawlith/plugin-snapshot-diff',
        '@crawlith/plugin-crawl-policy',
        '@crawlith/plugin-exporter',
    ],
    banner: {
        js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`
    }
});

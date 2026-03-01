import { describe, expect, test, vi } from 'vitest';
import { ConsoleCLIWriter, CoreReportBuilder } from '../src/plugin/writers.js';
import type { BaseReport } from '../src/plugin/types.js';

describe('CLIWriter', () => {
    test('respects log levels via level value filtering', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const writer = new ConsoleCLIWriter('warn'); // only warn and error should log

        writer.info('info message');
        expect(consoleSpy).not.toHaveBeenCalled();

        writer.warn('warn message');
        expect(warnSpy).toHaveBeenCalledWith('warn message');

        writer.error('error message');
        expect(errorSpy).toHaveBeenCalledWith('error message');

        consoleSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });
});

describe('ReportWriter', () => {
    test('enforces namespace and duplicate plugin section throws', () => {
        const base: BaseReport = {
            snapshotId: '123',
            pages: 10,
            summary: { healthScore: 100, status: 'good' },
            issues: {},
            metrics: {},
            plugins: {}
        };
        const builder = new CoreReportBuilder(base);

        builder.addSection('heading-health', { missing: 5 });
        expect(base.plugins['heading-health']).toEqual({ missing: 5 });

        expect(() => {
            builder.addSection('heading-health', { missing: 10 });
        }).toThrow('Duplicate plugin section: "heading-health" already exists in the report.');
    });

    test('score contributions aggregate correctly', () => {
        const base: BaseReport = {
            snapshotId: '123',
            pages: 10,
            summary: { healthScore: 100, status: 'good' },
            issues: {},
            metrics: {},
            plugins: {}
        };
        const builder = new CoreReportBuilder(base);

        // Contribute base score
        builder.contributeScore({ label: 'Core', score: 80, weight: 1.0 }); // 80 * 1 = 80
        // Plugin contributes some score
        builder.contributeScore({ label: 'Heading', score: 40, weight: 0.5 }); // 40 * 0.5 = 20
        // Total weight = 1.5. Sum = 100. Score = 100 / 1.5 = 66.666 => 67

        builder.finalizeScore();

        expect(base.summary.healthScore).toBe(67);
        expect(base.summary.status).toBe('warning');
    });

    test('invalid score contributions are ignored', () => {
        const base: BaseReport = {
            snapshotId: '123',
            pages: 10,
            summary: { healthScore: 100, status: 'good' },
            issues: {},
            metrics: {},
            plugins: {}
        };
        const builder = new CoreReportBuilder(base);

        // Core score
        builder.contributeScore({ label: 'Core', score: 90, weight: 1.0 });
        // Invalid score
        builder.contributeScore({ label: 'Plugin', score: 120, weight: 1.0 });

        builder.finalizeScore();

        // The invalid score should be ignored, so only Core score counts
        expect(base.summary.healthScore).toBe(90);
        expect(base.summary.status).toBe('good');
    });
});

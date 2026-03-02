import { describe, it, expect, vi } from 'vitest';
import { HealthScoreEnginePlugin } from '../index.js';

describe('HealthScoreEnginePlugin', () => {
    it('should exit with code 1 if failOnCritical is set and score < 50', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
            throw new Error(`exit:${code}`);
        });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const mockResult = {
            site_summary: { site_score: 45 }
        };

        const ctx = { flags: { failOnCritical: true } };

        await expect(
            HealthScoreEnginePlugin.hooks!.onReport!(ctx, mockResult)
        ).rejects.toThrow('exit:1');

        expect(errorSpy).toHaveBeenCalled();
        exitSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('should not exit if score is >= 50', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
            throw new Error(`exit:${code}`);
        });

        const mockResult = {
            site_summary: { site_score: 80 }
        };

        const ctx = { flags: { failOnCritical: true } };

        await HealthScoreEnginePlugin.hooks!.onReport!(ctx, mockResult);

        expect(exitSpy).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthScoreEnginePlugin } from '../index.js';
import { HealthService } from '../src/Service.js';
import { Graph } from '@crawlith/core';

describe('HealthScoreEnginePlugin', () => {
    let service: HealthService;

    beforeEach(() => {
        service = new HealthService();
        vi.restoreAllMocks();
    });

    it('should calculate health score correctly', () => {
        const issues = {
            orphanPages: 2,
            brokenInternalLinks: 1,
            redirectChains: 0,
            duplicateClusters: 0,
            canonicalConflicts: 0,
            accidentalNoindex: 0,
            missingH1: 0,
            thinContent: 0,
            lowInternalLinkCount: 0,
            excessiveInternalLinkCount: 0,
            blockedByRobots: 0
        };

        const result = service.calculateHealthScore(10, issues as any);
        expect(result.score).toBeLessThan(100);
        expect(result.status).toBeDefined();
    });

    it('should collect issues from graph', () => {
        const graph = new Graph();
        graph.addNode('https://example.com/', 0, 200);
        graph.addNode('https://example.com/broken', 1, 404);
        graph.addEdge('https://example.com/', 'https://example.com/broken');

        const metrics = {
            orphanPages: [],
            totalPages: 2
        };

        const issues = service.collectCrawlIssues(graph, metrics);
        expect(issues.brokenInternalLinks).toBeGreaterThanOrEqual(1);
    });

    it('should exit with code 1 if failOnCritical is set and score < 50', async () => {
        // Mock process.exit
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
            throw new Error(`exit:${code}`);
        });

        const mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        const ctx = {
            flags: { failOnCritical: true },
            logger: mockLogger,
            metadata: {
                healthReport: {
                    health: { score: 45, status: 'Critical' },
                    issues: {}
                }
            }
        };

        const mockResult = {};

        await expect(
            HealthScoreEnginePlugin.hooks!.onReport!(ctx as any, mockResult)
        ).rejects.toThrow('exit:1');

        expect(mockLogger.error).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it('should not exit if score is >= 50', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
            throw new Error(`exit:${code}`);
        });

        const ctx = {
            flags: { failOnCritical: true },
            metadata: {
                healthReport: {
                    health: { score: 80, status: 'Good' },
                    issues: {}
                }
            }
        };

        const mockResult = {};

        await HealthScoreEnginePlugin.hooks!.onReport!(ctx as any, mockResult);

        expect(exitSpy).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });
});

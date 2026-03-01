import { describe, it, expect } from 'vitest';
import { TrapDetector } from '../src/trap.js';

describe('TrapDetector', () => {
    const detector = new TrapDetector();

    it('should detect session ID traps', () => {
        const result = detector.checkTrap('https://example.com/page?sid=12345', 1);
        expect(result.risk).toBeGreaterThan(0.8);
        expect(result.type).toBe('session_trap');
    });

    it('should detect calendar patterns', () => {
        const result = detector.checkTrap('https://example.com/archive/2023/12/01/', 1);
        expect(result.risk).toBeGreaterThan(0.6);
        expect(result.type).toBe('calendar_trap');
    });

    it('should detect pagination loops', () => {
        // Simulate many pages
        for (let i = 1; i <= 60; i++) {
            detector.checkTrap(`https://example.com/blog?page=${i}`, 1);
        }
        const result = detector.checkTrap('https://example.com/blog?page=61', 1);
        expect(result.risk).toBeGreaterThan(0.8);
        expect(result.type).toBe('pagination_loop');
    });

    it('should detect faceted navigation / parameter explosion', () => {
        detector.reset();
        const basePath = 'https://example.com/products';
        for (let i = 1; i <= 35; i++) {
            detector.checkTrap(`${basePath}?color=red&size=${i}`, 1);
        }
        const result = detector.checkTrap(`${basePath}?color=blue&size=large`, 1);
        expect(result.risk).toBeGreaterThan(0.9);
        expect(result.type).toBe('faceted_navigation');
    });
});

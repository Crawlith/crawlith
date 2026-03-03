import { describe, expect, it } from 'vitest';
import { analyzeHeadingHealth } from '../src/analyzer.js';

describe('heading health analyzer', () => {
    it('detects missing H1 and hierarchy skips', () => {
        const html = `
      <title>Test Page</title>
      <h2>Subheading</h2>
      <h4>Jumped level</h4>
    `;
        const analysis = analyzeHeadingHealth(html);
        expect(analysis.issues).toContain('Missing H1');
        expect(analysis.issues).toContain('1 hierarchy skips detected');
        expect(analysis.metrics.missingH1).toBe(1);
        expect(analysis.metrics.hierarchySkips).toBe(1);
    });

    it('detects multiple H1s and title divergence', () => {
        const html = `
      <title>Correct Title</title>
      <h1>First H1</h1>
      <h1>Second H1 Divergent</h1>
    `;
        const analysis = analyzeHeadingHealth(html);
        expect(analysis.issues).toContain('Multiple H1 found');
        expect(analysis.issues).toContain('H1 diverges from <title>');
        expect(analysis.metrics.multipleH1).toBe(1);
    });

    it('extracts heading structure correctly', () => {
        const html = `
      <h1>Main</h1>
      <h2>Section 1</h2>
      <h3>Detail 1.1</h3>
      <h2>Section 2</h2>
    `;
        const analysis = analyzeHeadingHealth(html);
        expect(analysis.headingNodes).toHaveLength(4);
        expect(analysis.headingNodes[0].level).toBe(1);
        expect(analysis.headingNodes[1].parentIndex).toBe(0);
        expect(analysis.headingNodes[2].parentIndex).toBe(1);
        expect(analysis.headingNodes[3].parentIndex).toBe(0);
    });
});

import { test, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { compareGraphs } from '../src/diff/compare.js';

test('detects added and removed urls', () => {
  const oldGraph = new Graph();
  oldGraph.addNode('https://example.com/a', 0, 200);
  oldGraph.addNode('https://example.com/b', 1, 200);

  const newGraph = new Graph();
  newGraph.addNode('https://example.com/a', 0, 200);
  newGraph.addNode('https://example.com/c', 1, 200); // Added

  const diff = compareGraphs(oldGraph, newGraph);
  expect(diff.addedUrls).toContain('https://example.com/c');
  expect(diff.removedUrls).toContain('https://example.com/b');
});

test('detects status changes', () => {
  const oldGraph = new Graph();
  oldGraph.addNode('https://example.com/a', 0, 200);

  const newGraph = new Graph();
  newGraph.addNode('https://example.com/a', 0, 404);

  const diff = compareGraphs(oldGraph, newGraph);
  expect(diff.changedStatus).toHaveLength(1);
  expect(diff.changedStatus[0]).toEqual({
    url: 'https://example.com/a',
    oldStatus: 200,
    newStatus: 404
  });
});

test('detects canonical changes', () => {
  const oldGraph = new Graph();
  oldGraph.addNode('https://example.com/a', 0, 200);
  oldGraph.updateNodeData('https://example.com/a', { canonical: 'https://example.com/canon1' });

  const newGraph = new Graph();
  newGraph.addNode('https://example.com/a', 0, 200);
  newGraph.updateNodeData('https://example.com/a', { canonical: 'https://example.com/canon2' });

  const diff = compareGraphs(oldGraph, newGraph);
  expect(diff.changedCanonical).toHaveLength(1);
  expect(diff.changedCanonical[0]).toEqual({
    url: 'https://example.com/a',
    oldCanonical: 'https://example.com/canon1',
    newCanonical: 'https://example.com/canon2'
  });
});

test('calculates metric deltas', () => {
  const oldGraph = new Graph();
  // Orphan: A (depth 1, inLinks 0)
  oldGraph.addNode('https://example.com/a', 1, 200);

  const newGraph = new Graph();
  // Not Orphan: Root -> A
  newGraph.addNode('https://example.com/', 0, 200);
  newGraph.addNode('https://example.com/a', 1, 200);
  newGraph.addEdge('https://example.com/', 'https://example.com/a');

  const diff = compareGraphs(oldGraph, newGraph);
  // Old orphan count: 1 (A). New: 0. Delta: -1.
  expect(diff.metricDeltas.orphanCount).toBe(-1);
});


## 2024-05-28 - PageRank Calculation Bottleneck on Massive Site Graphs
**Learning:** During iterative algorithms like PageRank or HITS, accessing node data via `Map.get(url)` inside nested loops results in significant performance degradation for massive site graphs. `Map` lookups add unpredictable overhead to the inner computation cycle.
**Action:** Always map generic unique identifiers (like `url`s) to zero-indexed integers (`urlToIndex`) before entering iterative hot loops. Use typed contiguous arrays (like `Float64Array`) and standard contiguous arrays (for adjacency lists) for purely O(1) buffer lookups during the computation, mapping results back to URLs only after convergence.

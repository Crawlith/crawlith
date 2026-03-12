
## 2024-05-28 - PageRank Calculation Bottleneck on Massive Site Graphs
**Learning:** During iterative algorithms like PageRank or HITS, accessing node data via `Map.get(url)` inside nested loops results in significant performance degradation for massive site graphs. `Map` lookups add unpredictable overhead to the inner computation cycle.
**Action:** Always map generic unique identifiers (like `url`s) to zero-indexed integers (`urlToIndex`) before entering iterative hot loops. Use typed contiguous arrays (like `Float64Array`) and standard contiguous arrays (for adjacency lists) for purely O(1) buffer lookups during the computation, mapping results back to URLs only after convergence.

## 2024-06-05 - Avoid .getEdges() Array Allocations in Hot Paths
**Learning:** Generating the edge array via `graph.getEdges()` inside `calculateMetrics()` was resulting in excessive memory allocations (O(E) new objects per call) due to mapping over `graph.edges.entries()` and invoking `parseEdgeKey`. This caused unnecessary GC pressure for functions only needing edge connectivity info.
**Action:** When only needing source/target relationships, iterate over `graph.edges.keys()` and inline the string splitting (`indexOf('\x00')`) to avoid intermediate object allocation entirely.

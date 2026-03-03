export interface GraphNode {
  url: string;
  depth: number;
  inLinks: number;
  outLinks: number;
  status: number;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  brokenLinks?: string[];
  redirectChain?: string[];
  discoveredViaSitemap?: boolean;
  incrementalStatus?: 'new' | 'changed' | 'unchanged' | 'deleted';
  etag?: string;
  lastModified?: string;
  contentHash?: string;
  html?: string;
  simhash?: string;
  uniqueTokenRatio?: number;
  soft404Score?: number;
  soft404Signals?: string[];
  crawlTrapFlag?: boolean;
  crawlTrapRisk?: number;
  trapType?: string;
  securityError?: string;
  retries?: number;
  bytesReceived?: number;
  crawlStatus?: string;
  wordCount?: number;
  thinContentScore?: number;
  externalLinkRatio?: number;
  orphanScore?: number;
  h1Count?: number;
  h2Count?: number;
  headingHealthScore?: number;
  title?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface CrawlStats {
  pagesFetched: number;
  pagesCached: number;
  pagesSkipped: number;
  totalFound: number;
}

export class Graph {
  nodes: Map<string, GraphNode> = new Map();
  // Using JSON string of [source, target] to ensure uniqueness. Mapping to weight.
  edges: Map<string, number> = new Map();
  limitReached: boolean = false;
  sessionStats: CrawlStats = {
    pagesFetched: 0,
    pagesCached: 0,
    pagesSkipped: 0,
    totalFound: 0
  };
  trapClusters: { pattern: string; type: string; count: number }[] = [];

  /**
   * Generates a unique key for an edge.
   */
  static getEdgeKey(source: string, target: string): string {
    return JSON.stringify([source, target]);
  }

  /**
   * Parses an edge key back into source and target.
   */
  static parseEdgeKey(key: string): { source: string; target: string } {
    const [source, target] = JSON.parse(key);
    return { source, target };
  }

  /**
   * Adds a node to the graph if it doesn't exist.
   * If it exists, updates the status if the new status is non-zero (meaning we crawled it).
   * Depth is only set on creation (BFS guarantees shortest path first).
   */
  addNode(url: string, depth: number, status: number = 0) {
    const existing = this.nodes.get(url);
    if (!existing) {
      this.nodes.set(url, {
        url,
        depth,
        status,
        inLinks: 0,
        outLinks: 0
      });
    } else {
      // Update status if we have a real one now (e.g. was 0/pending, now crawled)
      if (status !== 0) {
        existing.status = status;
      }
    }
  }

  updateNodeData(url: string, data: Partial<GraphNode>) {
    const existing = this.nodes.get(url);
    if (existing) {
      Object.assign(existing, data);
    }
  }

  /**
   * Adds a directed edge between two nodes.
   * Both nodes must exist in the graph.
   * Updates inLinks and outLinks counts.
   */
  addEdge(source: string, target: string, weight: number = 1.0) {
    const sourceNode = this.nodes.get(source);
    const targetNode = this.nodes.get(target);

    if (sourceNode && targetNode) {
      const edgeKey = Graph.getEdgeKey(source, target);
      if (!this.edges.has(edgeKey)) {
        this.edges.set(edgeKey, weight);
        sourceNode.outLinks++;
        targetNode.inLinks++;
      } else {
        // If edge exists, keep highest weight (or could sum, but usually we just want the 'best' relationship)
        const currentWeight = this.edges.get(edgeKey) || 0;
        if (weight > currentWeight) {
          this.edges.set(edgeKey, weight);
        }
      }
    }
  }

  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): GraphEdge[] {
    return Array.from(this.edges.entries()).map(([edge, weight]) => {
      const { source, target } = Graph.parseEdgeKey(edge);
      return { source, target, weight };
    });
  }

  toJSON() {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges()
    };
  }

  static fromJSON(json: any): Graph {
    const graph = new Graph();
    if (json.nodes) {
      for (const node of json.nodes) {
        graph.nodes.set(node.url, { ...node });
      }
    }
    if (json.edges) {
      for (const edge of json.edges) {
        const key = Graph.getEdgeKey(edge.source, edge.target);
        graph.edges.set(key, edge.weight || 1.0);
      }
    }

    return graph;
  }
}

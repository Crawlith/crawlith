export interface PageRankRow {
    raw_rank: number;
    score: number;
}

export interface PageRankOptions {
    dampingFactor?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
    soft404WeightThreshold?: number;
}

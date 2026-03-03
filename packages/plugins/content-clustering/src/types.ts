export interface ClusterInfo {
    id: number;
    count: number;
    primaryUrl: string;
    risk: 'low' | 'medium' | 'high';
    sharedPathPrefix?: string;
}

export interface ClusteringOptions {
    threshold?: number;
    minSize?: number;
}

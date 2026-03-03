/**
 * Represents the summary of a PageSpeed Insight analysis.
 */
export interface PageSpeedSummary {
    strategy: 'mobile' | 'desktop';
    score: number;
    lcp: number | null;
    cls: number | null;
    tbt: number | null;
    coreWebVitals: 'PASS' | 'FAIL';
    hasFieldData: boolean;
    source: 'cache' | 'api';
}

/**
 * Represents a row in the PageSpeed plugin's database table.
 */
export interface PageSpeedRow {
    id: number;
    snapshot_id: number;
    url_id: number;
    strategy: string;
    performance_score: number;
    lcp: number;
    cls: number;
    tbt: number;
    raw_json: any;
    created_at: string;
}

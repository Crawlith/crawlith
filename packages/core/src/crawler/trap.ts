
export type TrapType = 'faceted_navigation' | 'calendar_trap' | 'pagination_loop' | 'session_trap';

export interface TrapResult {
    risk: number;
    type: TrapType | null;
}

export class TrapDetector {
    private pathCounters = new Map<string, Set<string>>();
    private paginationCounters = new Map<string, number>();
    private sessionParams = new Set(['sid', 'session', 'phpsessid', 'sessid', 'token']);

    // Configurable thresholds
    private PARAM_EXPLOSION_THRESHOLD = 30;
    private PAGINATION_THRESHOLD = 50;

    constructor(options: { paramThreshold?: number, paginationThreshold?: number } = {}) {
        if (options.paramThreshold) this.PARAM_EXPLOSION_THRESHOLD = options.paramThreshold;
        if (options.paginationThreshold) this.PAGINATION_THRESHOLD = options.paginationThreshold;
    }

    /**
     * Checks if a URL represents a potential crawl trap.
     */
    checkTrap(rawUrl: string, _depth: number): TrapResult {
        let risk = 0;
        let type: TrapType | null = null;

        try {
            const u = new URL(rawUrl);
            const params = new URLSearchParams(u.search);
            const pathname = u.pathname;
            const pathKey = `${u.origin}${pathname}`;

            // 1. Session IDs / Tracking Parameters
            for (const [key] of params) {
                if (this.sessionParams.has(key.toLowerCase()) || key.toLowerCase().includes('session')) {
                    risk = Math.max(risk, 0.9);
                    type = 'session_trap';
                }
            }

            // 2. Calendar Pattern Detection
            // Matches /2023/12/01, /2023-12-01, /12-2023 etc
            const calendarRegex = /\/\d{4}[-/]\d{2}[-/]\d{2}\/|\/\d{2}[-/]\d{2}[-/]\d{4}\//;
            if (calendarRegex.test(pathname)) {
                risk = Math.max(risk, 0.7);
                type = 'calendar_trap';
            }

            // 3. Pagination Loop
            const pageParam = params.get('page') || params.get('p') || params.get('pg');
            if (pageParam && /^\d+$/.test(pageParam)) {
                const pageNum = parseInt(pageParam, 10);
                const currentMaxPage = this.paginationCounters.get(pathKey) || 0;

                if (pageNum > currentMaxPage) {
                    this.paginationCounters.set(pathKey, pageNum);
                }

                if (pageNum > this.PAGINATION_THRESHOLD) {
                    risk = Math.max(risk, 0.85);
                    type = 'pagination_loop';
                }
            }

            // 4. Infinite Parameter Explosion (Faceted Navigation)
            if (params.size > 0) {
                const paramSet = this.pathCounters.get(pathKey) || new Set<string>();
                params.sort();
                const paramKey = params.toString();
                paramSet.add(paramKey);
                this.pathCounters.set(pathKey, paramSet);

                if (paramSet.size > this.PARAM_EXPLOSION_THRESHOLD) {
                    risk = Math.max(risk, 0.95);
                    if (!type) type = 'faceted_navigation';
                }
            }

        } catch (_e) {
            // Invalid URL
        }

        return { risk, type };
    }

    /**
     * Iterates over all nodes in the graph and flags potential traps.
     */
    analyze(graph: any) {
        const nodes = graph.getNodes();
        for (const node of nodes) {
            if (node.status === 200 || node.status === 0) {
                const res = this.checkTrap(node.url, node.depth || 0);
                if (res.risk > 0.4) {
                    node.crawlTrapFlag = true;
                    node.crawlTrapRisk = res.risk;
                    node.trapType = res.type;
                }
            }
        }
    }

    /**
     * Resets internal state (useful for multi-crawl sessions if needed)
     */
    reset() {
        this.pathCounters.clear();
        this.paginationCounters.clear();
    }
}

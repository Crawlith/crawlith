export class RedirectController {
    private maxHops: number;
    private currentHops: number = 0;
    private history: Set<string> = new Set();

    constructor(maxHops: number = 5, seedUrl?: string) {
        this.maxHops = maxHops;
        if (seedUrl) {
            this.history.add(this.normalize(seedUrl));
        }
    }

    /**
     * Records a hop and checks if it's within limits and not a loop.
     * Returns null if allowed, or an error status string if blocked.
     */
    nextHop(url: string): 'redirect_limit_exceeded' | 'redirect_loop' | null {
        // Normalize URL for loop detection (basic)
        const normalized = this.normalize(url);

        if (this.history.has(normalized)) {
            return 'redirect_loop';
        }

        if (this.currentHops >= this.maxHops) {
            return 'redirect_limit_exceeded';
        }

        this.history.add(normalized);
        this.currentHops++;
        return null;
    }

    get hops(): number {
        return this.currentHops;
    }

    private normalize(url: string): string {
        try {
            const u = new URL(url);
            u.hash = ''; // Ignore hash for loop detection
            return u.toString();
        } catch {
            return url;
        }
    }
}

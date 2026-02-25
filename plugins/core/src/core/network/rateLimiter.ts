export class RateLimiter {
    private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
    private rate: number; // tokens per second

    constructor(rate: number = 2) {
        this.rate = rate;
    }

    async waitForToken(host: string, crawlDelay: number = 0): Promise<void> {
        const effectiveRate = crawlDelay > 0 ? Math.min(this.rate, 1 / crawlDelay) : this.rate;
        const interval = 1000 / effectiveRate;

        if (!this.buckets.has(host)) {
            this.buckets.set(host, { tokens: this.rate - 1, lastRefill: Date.now() });
            return;
        }

        const bucket = this.buckets.get(host)!;

        while (true) {
            const now = Date.now();
            const elapsed = now - bucket.lastRefill;

            if (elapsed > 0) {
                const newTokens = elapsed / interval;
                bucket.tokens = Math.min(this.rate, bucket.tokens + newTokens);
                bucket.lastRefill = now;
            }

            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                return;
            }

            const waitTime = Math.max(0, interval - (Date.now() - bucket.lastRefill));
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

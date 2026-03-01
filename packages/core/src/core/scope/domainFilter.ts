export class DomainFilter {
    private allowed: Set<string>;
    private denied: Set<string>;

    constructor(allowed: string[] = [], denied: string[] = []) {
        this.allowed = new Set(allowed.map(d => this.normalize(d)));
        this.denied = new Set(denied.map(d => this.normalize(d)));
    }

    /**
     * Normalizes a hostname: lowercase, strip trailing dot.
     * Note: We expect hostnames, not URLs.
     */
    private normalize(hostname: string): string {
        let h = hostname.toLowerCase().trim();
        if (h.endsWith('.')) {
            h = h.slice(0, -1);
        }
        // Use URL to handle punycode and basic validation if possible
        try {
            // We wrap it in a dummy URL to let the browser/node logic normalize it
            const url = new URL(`http://${h}`);
            return url.hostname;
        } catch {
            return h;
        }
    }

    isAllowed(hostname: string): boolean {
        const normalized = this.normalize(hostname);

        // 1. Deny list match -> Reject
        if (this.denied.has(normalized)) {
            return false;
        }

        // 2. Allow list not empty AND no match -> Reject
        if (this.allowed.size > 0 && !this.allowed.has(normalized)) {
            return false;
        }

        // 3. Otherwise -> Allow
        return true;
    }
}

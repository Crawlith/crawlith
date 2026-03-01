export class SubdomainPolicy {
    private rootHost: string;
    private includeSubdomains: boolean;

    constructor(rootUrl: string, includeSubdomains: boolean = false) {
        try {
            this.rootHost = new URL(rootUrl).hostname.toLowerCase();
            if (this.rootHost.endsWith('.')) {
                this.rootHost = this.rootHost.slice(0, -1);
            }
        } catch {
            this.rootHost = '';
        }
        this.includeSubdomains = includeSubdomains;
    }

    isAllowed(hostname: string): boolean {
        let target = hostname.toLowerCase().trim();
        if (target.endsWith('.')) {
            target = target.slice(0, -1);
        }

        // Exact match is always allowed if rootHost is set
        if (target === this.rootHost) {
            return true;
        }

        if (!this.includeSubdomains) {
            return false;
        }

        // Label-based check for subdomains
        // target must end with .rootHost
        if (!target.endsWith(`.${this.rootHost}`)) {
            return false;
        }
        return true;
    }
}

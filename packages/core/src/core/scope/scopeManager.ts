import { DomainFilter } from './domainFilter.js';
import { SubdomainPolicy } from './subdomainPolicy.js';

export interface ScopeOptions {
    allowedDomains?: string[];
    deniedDomains?: string[];
    includeSubdomains?: boolean;
    rootUrl: string;
}

export type EligibilityResult = 'allowed' | 'blocked_by_domain_filter' | 'blocked_subdomain';

export class ScopeManager {
    private domainFilter: DomainFilter;
    private subdomainPolicy: SubdomainPolicy;
    private explicitAllowed: Set<string>;

    constructor(options: ScopeOptions) {
        this.domainFilter = new DomainFilter(options.allowedDomains, options.deniedDomains);
        this.subdomainPolicy = new SubdomainPolicy(options.rootUrl, options.includeSubdomains);
        this.explicitAllowed = new Set((options.allowedDomains || []).map(d => {
            let h = d.toLowerCase().trim();
            if (h.endsWith('.')) h = h.slice(0, -1);
            return h;
        }));
    }

    isUrlEligible(url: string): EligibilityResult {
        // Root-relative paths (e.g. '/about', '/?q=foo') are always internal
        if (url.startsWith('/')) return 'allowed';

        let hostname: string;
        try {
            hostname = new URL(url).hostname.toLowerCase();
            if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
        } catch {
            return 'blocked_by_domain_filter'; // Invalid URL is effectively blocked
        }

        if (!this.domainFilter.isAllowed(hostname)) {
            return 'blocked_by_domain_filter';
        }

        // If explicit whitelist is used, and this domain is in it, allow it
        if (this.explicitAllowed.has(hostname)) {
            return 'allowed';
        }

        if (!this.subdomainPolicy.isAllowed(hostname)) {
            return 'blocked_subdomain';
        }

        return 'allowed';
    }
}

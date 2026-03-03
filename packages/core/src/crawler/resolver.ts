import { Fetcher } from './fetcher.js';
import { SiteRepository, Site } from '../db/repositories/SiteRepository.js';
import { getDb } from '../db/index.js';

export interface ResolvedUrl {
    url: string;
    site: Site;
}

export class UrlResolver {
    private siteRepo: SiteRepository;

    constructor() {
        this.siteRepo = new SiteRepository(getDb());
    }

    async resolve(inputUrl: string, fetcher: Fetcher): Promise<ResolvedUrl> {
        let hasProtocol = inputUrl.startsWith('http://') || inputUrl.startsWith('https://');
        let workingUrl = hasProtocol ? inputUrl : `https://${inputUrl}`;

        let hostname: string;
        try {
            hostname = new URL(workingUrl).hostname;
        } catch {
            throw new Error(`Invalid URL or domain: ${inputUrl}`);
        }

        const domain = hostname.replace(/^www\./, '');
        let site = this.siteRepo.firstOrCreateSite(domain);

        // If protocol was omitted, we use our discovery logic or stored preference
        if (!hasProtocol) {
            if (site.ssl !== null && site.preferred_url) {
                return {
                    url: site.preferred_url,
                    site
                };
            }

            // No protocol provided and no stored preference: Probe HTTPS first
            try {
                const res = await fetcher.fetch(`https://${hostname}/`);
                if (typeof res.status === 'number' && res.status >= 200 && res.status < 400) {
                    const isSsl = res.finalUrl.startsWith('https:');
                    this.siteRepo.updateSitePreference(site.id, res.finalUrl, isSsl);

                    // Refresh site object
                    site = this.siteRepo.getSiteById(site.id)!;
                    return { url: res.finalUrl, site };
                }
            } catch {
                // Fallback to HTTP
            }

            // Try HTTP
            try {
                const res = await fetcher.fetch(`http://${hostname}/`);
                if (typeof res.status === 'number' && res.status >= 200 && res.status < 400) {
                    const isSsl = res.finalUrl.startsWith('https:');
                    this.siteRepo.updateSitePreference(site.id, res.finalUrl, isSsl);

                    site = this.siteRepo.getSiteById(site.id)!;
                    return { url: res.finalUrl, site };
                }
            } catch {
                // If both fail, we still default to the provided input as https
                return { url: workingUrl, site };
            }
        }

        // Protocol was provided, we just return it but ensure site is in sync if it's the first time
        if (site.ssl === null) {
            this.siteRepo.updateSitePreference(site.id, inputUrl, inputUrl.startsWith('https:'));
            site = this.siteRepo.getSiteById(site.id)!;
        }

        return { url: inputUrl, site };
    }
}

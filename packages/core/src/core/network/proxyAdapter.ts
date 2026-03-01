import { ProxyAgent } from 'undici';

export class ProxyAdapter {
    private agent?: ProxyAgent;

    constructor(proxyUrl?: string) {
        if (proxyUrl) {
            try {
                // Validate URL
                new URL(proxyUrl);
                this.agent = new ProxyAgent(proxyUrl);
            } catch {
                throw new Error(`Invalid proxy URL: ${proxyUrl}`);
            }
        }
    }

    get dispatcher() {
        return this.agent;
    }
}

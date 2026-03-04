import { PageSpeedSummary } from './types.js';

const PAGESPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Service responsible for interacting with the Google PageSpeed Insights API.
 * Handles API requests, retries with exponential backoff, and data summarization.
 */
export class PageSpeedService {
    /**
     * Executes a fetch to the PageSpeed Insights API with timeout and retry behavior.
     * 
     * @param url - The absolute URL of the page to analyze.
     * @param apiKey - The decrypted Google API key.
     * @param strategy - The analysis strategy ('mobile' or 'desktop').
     * @returns The raw JSON response from the PageSpeed API.
     * @throws Error if the request fails after maximum retries or returns a non-OK status.
     */
    async fetch(url: string, apiKey: string, strategy: string): Promise<any> {
        const params = new URLSearchParams({
            url,
            category: 'performance',
            strategy,
            key: apiKey
        });

        const maxRetries = 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`, {
                    signal: AbortSignal.timeout(60000)
                });
                const raw = await response.json();

                if (!response.ok) {
                    const message = raw?.error?.message || `PageSpeed request failed with status ${response.status}`;
                    throw new Error(message);
                }

                if (raw?.lighthouseResult?.runtimeError) {
                    throw new Error(`Lighthouse returned error: ${raw.lighthouseResult.runtimeError.message || 'Unknown error'}`);
                }

                return raw;
            } catch (error) {
                if (attempt >= maxRetries) throw error;
                const delayMs = 500 * (2 ** attempt);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    /**
     * Transforms a raw Lighthouse/PageSpeed API response into a compact summary.
     * 
     * @param response - The raw JSON response from Google.
     * @param source - Whether the data comes from 'api' or 'cache'.
     * @param strategy - The strategy used for analysis.
     * @returns A PageSpeedSummary object containing core web vitals and performance scores.
     */
    summarize(response: any, source: 'cache' | 'api', strategy: 'mobile' | 'desktop'): PageSpeedSummary {
        const categories = response?.lighthouseResult?.categories || {};
        const audits = response?.lighthouseResult?.audits || {};
        const fieldData = response?.loadingExperience?.overall_category;

        const score = Math.round((categories.performance?.score ?? 0) * 100);
        const lcp = typeof audits['largest-contentful-paint']?.numericValue === 'number'
            ? Number((audits['largest-contentful-paint'].numericValue / 1000).toFixed(2))
            : null;
        const cls = typeof audits['cumulative-layout-shift']?.numericValue === 'number'
            ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3))
            : null;
        const tbt = typeof audits['total-blocking-time']?.numericValue === 'number'
            ? Number(Math.round(audits['total-blocking-time'].numericValue))
            : null;

        return {
            strategy,
            score,
            lcp,
            cls,
            tbt,
            coreWebVitals: fieldData === 'FAST' ? 'PASS' : 'FAIL',
            hasFieldData: fieldData !== undefined,
            source
        };
    }
}

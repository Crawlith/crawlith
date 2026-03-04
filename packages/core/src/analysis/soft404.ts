import * as cheerio from 'cheerio';

export interface Soft404Result {
    score: number;
    reason: string;
}

/**
 * Service to analyze HTML content for soft 404 signals.
 * Extracts signals from title, H1, body content length, and outlinks.
 */
export class Soft404Service {
    /**
     * Analyzes HTML string to determine probability of being a soft 404 page.
     * @param {string | undefined} html - Raw HTML source code.
     * @param {number} outLinks - Total number of outbound links extracted during parsing.
     * @returns {Soft404Result} A calculated score between 0.0 and 1.0, and the matched reasons.
     */
    public analyze(html: string | undefined, outLinks: number): Soft404Result {
        if (!html) return { score: 0, reason: '' };

        let score = 0;
        const signals: string[] = [];

        const $ = cheerio.load(html);
        $('script, style, noscript, iframe').remove();

        const cleanText = $('body').text().replace(/\s+/g, ' ').trim();
        const title = $('title').text().toLowerCase();
        const h1Text = $('h1').first().text().toLowerCase();
        const bodyText = cleanText.toLowerCase();

        const errorPatterns = ['404', 'not found', 'error', "doesn't exist", 'unavailable', 'invalid'];

        for (const pattern of errorPatterns) {
            if (title.includes(pattern)) {
                score += 0.4;
                signals.push(`title_contains_${pattern}`);
                break;
            }
        }

        for (const pattern of errorPatterns) {
            if (h1Text.includes(pattern)) {
                score += 0.3;
                signals.push(`h1_contains_${pattern}`);
                break;
            }
        }

        if (bodyText.includes('page not found') || bodyText.includes('404 error')) {
            score += 0.2;
            signals.push('body_error_phrase');
        }

        const words = cleanText.split(/\s+/).filter(w => w.length > 0);
        if (words.length < 50) {
            score += 0.3;
            signals.push('very_low_word_count');
        } else if (words.length < 150) {
            score += 0.1;
            signals.push('low_word_count');
        }

        if (outLinks === 0) {
            score += 0.2;
            signals.push('no_outbound_links');
        }

        score = Math.min(1.0, score);

        return {
            score: Number(score.toFixed(2)),
            reason: signals.join(', ')
        };
    }
}

import { load } from 'cheerio';

export interface ContentAnalysis {
  wordCount: number;
  textHtmlRatio: number;
  uniqueSentenceCount: number;
}

export interface ThinScoreWeights {
  lowWordWeight: number;
  ratioWeight: number;
  dupWeight: number;
}

const DEFAULT_WEIGHTS: ThinScoreWeights = {
  lowWordWeight: 0.4,
  ratioWeight: 0.35,
  dupWeight: 0.25
};

export function analyzeContent($: any): ContentAnalysis {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  // We don't want to modify the shared $ object if we remove elements
  // So we create a localized copy of the body text or use selection
  const body = cheerioObj('body').length ? cheerioObj('body') : cheerioObj('html');

  // To avoid removing from shared $, we extract text from a clone if possible, 
  // but cloning in cheerio is expensive. 
  // Better: just get the text and clean it or use a filter.
  const text = body.clone().find('script,style,nav,footer').remove().end().text();
  const cleanText = text.replace(/\s+/g, ' ').trim();

  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const htmlLength = isString ? ($.length || 1) : 1000; // Fallback if we don't have original HTML length
  const textHtmlRatio = cleanText.length / htmlLength;

  const sentenceSet = new Set(
    cleanText
      .split(/[.!?]+/)
      .map((item: string) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  return {
    wordCount,
    textHtmlRatio,
    uniqueSentenceCount: sentenceSet.size
  };
}

export function calculateThinContentScore(
  content: ContentAnalysis,
  duplicationScore: number,
  weights: ThinScoreWeights = DEFAULT_WEIGHTS
): number {
  const wordScore = content.wordCount >= 300 ? 0 : 100 - Math.min(100, (content.wordCount / 300) * 100);
  const textRatioScore = content.textHtmlRatio >= 0.2 ? 0 : 100 - Math.min(100, (content.textHtmlRatio / 0.2) * 100);

  const raw =
    weights.lowWordWeight * wordScore +
    weights.ratioWeight * textRatioScore +
    weights.dupWeight * duplicationScore;

  return Math.max(0, Math.min(100, Number(raw.toFixed(2))));
}

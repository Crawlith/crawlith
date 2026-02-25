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

export function analyzeContent(html: string): ContentAnalysis {
  const $ = load(html || '<html></html>');
  $('script,style,nav,footer').remove();

  const text = $('body').length ? $('body').text() : $.text();
  const cleanText = text.replace(/\s+/g, ' ').trim();

  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const htmlLength = Math.max(html.length, 1);
  const textHtmlRatio = cleanText.length / htmlLength;

  const sentenceSet = new Set(
    cleanText
      .split(/[.!?]+/)
      .map((item) => item.trim().toLowerCase())
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

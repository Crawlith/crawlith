import { load } from 'cheerio';

export type SeoStatus = 'ok' | 'missing' | 'too_short' | 'too_long' | 'duplicate';

export interface TextFieldAnalysis {
  value: string | null;
  length: number;
  status: SeoStatus;
}

export interface H1Analysis {
  count: number;
  status: 'ok' | 'critical' | 'warning';
  matchesTitle: boolean;
}

function normalizedText(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function analyzeTitle(html: string): TextFieldAnalysis {
  const $ = load(html);
  const title = $('title').first().text().trim();
  if (!title) {
    return { value: null, length: 0, status: 'missing' };
  }

  if (title.length < 50) return { value: title, length: title.length, status: 'too_short' };
  if (title.length > 60) return { value: title, length: title.length, status: 'too_long' };
  return { value: title, length: title.length, status: 'ok' };
}

export function analyzeMetaDescription(html: string): TextFieldAnalysis {
  const $ = load(html);
  const raw = $('meta[name="description"]').attr('content');
  if (raw === undefined) {
    return { value: null, length: 0, status: 'missing' };
  }

  const description = raw.trim();
  if (!description) {
    return { value: '', length: 0, status: 'missing' };
  }

  if (description.length < 140) return { value: description, length: description.length, status: 'too_short' };
  if (description.length > 160) return { value: description, length: description.length, status: 'too_long' };
  return { value: description, length: description.length, status: 'ok' };
}

export function applyDuplicateStatuses<T extends TextFieldAnalysis>(fields: T[]): T[] {
  const counts = new Map<string, number>();
  for (const field of fields) {
    const key = normalizedText(field.value);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return fields.map((field) => {
    const key = normalizedText(field.value);
    if (!key) return field;
    if ((counts.get(key) || 0) > 1) {
      return { ...field, status: 'duplicate' };
    }
    return field;
  });
}

export function analyzeH1(html: string, titleValue: string | null): H1Analysis {
  const $ = load(html);
  const h1Values = $('h1').toArray().map((el) => $(el).text().trim()).filter(Boolean);
  const count = h1Values.length;
  const first = h1Values[0] || null;
  const matchesTitle = Boolean(first && titleValue && normalizedText(first) === normalizedText(titleValue));

  if (count === 0) {
    return { count, status: 'critical', matchesTitle };
  }
  if (count > 1) {
    return { count, status: 'warning', matchesTitle };
  }
  return { count, status: 'ok', matchesTitle };
}

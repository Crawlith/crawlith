import { CheerioAPI, load } from 'cheerio';

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

export function analyzeTitle($: CheerioAPI | string): TextFieldAnalysis {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  const title = cheerioObj('title').first().text().trim();
  if (!title) {
    return { value: null, length: 0, status: 'missing' };
  }

  if (title.length < 50) return { value: title, length: title.length, status: 'too_short' };
  if (title.length > 60) return { value: title, length: title.length, status: 'too_long' };
  return { value: title, length: title.length, status: 'ok' };
}

export function analyzeMetaDescription($: CheerioAPI | string): TextFieldAnalysis {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  const raw = cheerioObj('meta[name="description"]').attr('content');
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

export function analyzeH1($: CheerioAPI | string, titleValue: string | null): H1Analysis {
  const isString = typeof $ === 'string';
  const cheerioObj = isString ? load($ || '<html></html>') : $;

  const h1Values = cheerioObj('h1').toArray().map((el) => cheerioObj(el).text().trim()).filter(Boolean);
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

export function applyDuplicateStatuses<T extends { value: string | null; status: string }>(items: T[]): T[] {
  const counts = new Map<string, number>();
  const normalizedToOriginal = new Map<string, string>();

  // First pass: count occurrences of each normalized value
  for (const item of items) {
    if (item.value) {
      const normalized = normalizedText(item.value);
      if (normalized) {
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
        if (!normalizedToOriginal.has(normalized)) {
          normalizedToOriginal.set(normalized, item.value);
        }
      }
    }
  }

  // Second pass: apply duplicate status
  return items.map(item => {
    if (item.value) {
      const normalized = normalizedText(item.value);
      if ((counts.get(normalized) || 0) > 1) {
        return { ...item, status: 'duplicate' };
      }
    }
    return item;
  });
}

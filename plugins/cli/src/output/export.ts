import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AnalysisResult,
  renderAnalysisHtml,
  renderAnalysisMarkdown,
  renderAnalysisCsv
} from '@crawlith/core';

export async function exportAnalysisResult(
  result: AnalysisResult,
  format: 'json' | 'csv' | 'markdown' | 'html',
  outputDir: string
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  let filename: string;
  let content: string;

  switch (format) {
    case 'json':
      filename = 'analysis.json';
      content = JSON.stringify(result, null, 2);
      break;
    case 'html':
      filename = 'analysis.html';
      content = renderAnalysisHtml(result);
      break;
    case 'markdown':
      filename = 'analysis.md';
      content = renderAnalysisMarkdown(result);
      break;
    case 'csv':
      filename = 'analysis.csv';
      content = renderAnalysisCsv(result);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  return filepath;
}

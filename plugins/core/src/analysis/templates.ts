import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ANALYSIS_LIST_TEMPLATE = fs.readFileSync(path.join(__dirname, 'analysis_list.html'), 'utf-8');
export const ANALYSIS_PAGE_TEMPLATE = fs.readFileSync(path.join(__dirname, 'analysis_page.html'), 'utf-8');

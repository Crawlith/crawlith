import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.join(__dirname, 'crawl.html');

export const Crawl_HTML = fs.readFileSync(templatePath, 'utf-8');

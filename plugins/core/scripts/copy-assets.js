import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const src = path.join(__dirname, '../src/report/sitegraph.html');
const dest = path.join(__dirname, '../dist/report/sitegraph.html');

fs.copyFileSync(src, dest);

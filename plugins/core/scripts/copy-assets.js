import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dist directories exist
const reportDestDir = path.join(__dirname, '../dist/report');
if (!fs.existsSync(reportDestDir)){
    fs.mkdirSync(reportDestDir, { recursive: true });
}

const analysisDestDir = path.join(__dirname, '../dist/analysis');
if (!fs.existsSync(analysisDestDir)){
    fs.mkdirSync(analysisDestDir, { recursive: true });
}

// Copy Report Assets
const sitegraphSrc = path.join(__dirname, '../src/report/sitegraph.html');
const sitegraphDest = path.join(reportDestDir, 'sitegraph.html');
if (fs.existsSync(sitegraphSrc)) {
  fs.copyFileSync(sitegraphSrc, sitegraphDest);
}

// Copy Analysis Assets
const analysisListSrc = path.join(__dirname, '../src/analysis/analysis_list.html');
const analysisListDest = path.join(analysisDestDir, 'analysis_list.html');
if (fs.existsSync(analysisListSrc)) {
  fs.copyFileSync(analysisListSrc, analysisListDest);
}

const analysisPageSrc = path.join(__dirname, '../src/analysis/analysis_page.html');
const analysisPageDest = path.join(analysisDestDir, 'analysis_page.html');
if (fs.existsSync(analysisPageSrc)) {
  fs.copyFileSync(analysisPageSrc, analysisPageDest);
}

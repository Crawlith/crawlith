import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let version = '0.0.1';
let pkg: any = { name: '@crawlith/cli', version: '0.0.1' };

try {
    const pkgPath = join(__dirname, '../package.json');
    const pkgData = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkg = pkgData;
    version = pkg.version;
} catch {
    // Fallback to internal default
}

export { version, pkg };

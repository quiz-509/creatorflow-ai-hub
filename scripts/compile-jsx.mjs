/**
 * Pré-compile le JSX Babel inline de toutes les pages HTML.
 * Supprime le tag Babel CDN et remplace <script type="text/babel"> par <script>.
 *
 * Usage : node livrables/scripts/compile-jsx.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SITES_DIR = join(__dirname, '../sites-web');

const babel = require('./node_modules/@babel/core/lib/index.js');
const presetReact = require('./node_modules/@babel/preset-react/lib/index.js');

const BABEL_CDN_PATTERN = /<script[^>]+@babel\/standalone[^>]*>\s*<\/script>\n?/g;
const BABEL_SCRIPT_PATTERN = /<script\s+type="text\/babel">([\s\S]*?)<\/script>/g;

let totalFiles = 0;
let compiledFiles = 0;
const errors = [];

const htmlFiles = readdirSync(SITES_DIR).filter(f => f.endsWith('.html'));

for (const filename of htmlFiles) {
  const filePath = join(SITES_DIR, filename);
  let html = readFileSync(filePath, 'utf8');

  if (!html.includes('text/babel')) continue;
  totalFiles++;

  try {
    let compiled = html.replace(BABEL_SCRIPT_PATTERN, (match, jsxCode) => {
      const result = babel.transformSync(jsxCode, {
        presets: [presetReact],
        filename,
        configFile: false,
        babelrc: false,
      });
      return `<script>\n${result.code}\n</script>`;
    });

    compiled = compiled.replace(BABEL_CDN_PATTERN, '');

    writeFileSync(filePath, compiled, 'utf8');
    compiledFiles++;
    process.stdout.write(`✓ ${filename}\n`);
  } catch (err) {
    errors.push({ filename, error: err.message.split('\n')[0] });
    process.stdout.write(`✗ ${filename}: ${err.message.split('\n')[0]}\n`);
  }
}

process.stdout.write(`\n${compiledFiles}/${totalFiles} fichiers compilés.\n`);
if (errors.length > 0) {
  process.stdout.write(`\nEchecs (${errors.length}):\n`);
  errors.forEach(e => process.stdout.write(`  - ${e.filename}: ${e.error}\n`));
}

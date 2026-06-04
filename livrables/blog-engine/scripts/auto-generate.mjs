#!/usr/bin/env node
// auto-generate.mjs — Picks next topic from topics-queue.json and generates the article
// Usage: RUN_INDEX=42 node scripts/auto-generate.mjs
// In GitHub Actions: uses ${{ github.run_number }} as RUN_INDEX

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const topics = JSON.parse(readFileSync(join(__dirname, 'topics-queue.json'), 'utf-8'));
const runIndex = parseInt(process.env.RUN_INDEX || '0', 10);
const topic = topics[runIndex % topics.length];

console.log(`\n${'='.repeat(60)}`);
console.log(`🤖 Auto-generate — Run #${runIndex}`);
console.log(`📝 Sujet #${(runIndex % topics.length) + 1}/${topics.length}`);
console.log(`   ${topic.title}`);
console.log(`   Catégorie : ${topic.category}`);
console.log(`${'='.repeat(60)}\n`);

const title = topic.title.replace(/"/g, '\\"');
const category = topic.category.replace(/"/g, '\\"');

try {
  execSync(
    `node scripts/generate-article.js --title "${title}" --category "${category}"`,
    { stdio: 'inherit', encoding: 'utf8', cwd: join(__dirname, '..') }
  );
  console.log(`\n✅ Article généré avec succès`);
} catch (e) {
  console.error(`\n❌ Échec de génération : ${e.message}`);
  process.exit(1);
}

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_FILES = ['.env', '.env.local', 'server/.env'];
const DANGEROUS_KEYS = ['API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'PRIVATE_KEY'];

function fileHasSecrets(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  return lines
    .map((line, idx) => ({ line, idx: idx + 1 }))
    .filter(({ line }) => DANGEROUS_KEYS.some((key) => line.includes(key)) && line.includes('=') && !line.trim().startsWith('#'))
    .map(({ idx, line }) => `${idx}:${line.slice(0, 80)}`);
}

const findings = [];
for (const relativePath of TARGET_FILES) {
  const absolutePath = path.join(ROOT, relativePath);
  const hits = fileHasSecrets(absolutePath);
  if (hits.length > 0) findings.push({ file: relativePath, hits });
}

if (findings.length > 0) {
  console.error('[secrets-check] Potential secrets found:');
  for (const finding of findings) {
    console.error(`- ${finding.file}`);
    for (const hit of finding.hits) console.error(`  ${hit}`);
  }
  if (process.env.CI === 'true') {
    process.exit(1);
  }
  console.warn('[secrets-check] Non-CI mode: warning only.');
  process.exit(0);
}

console.log('[secrets-check] No obvious secrets detected in env files.');

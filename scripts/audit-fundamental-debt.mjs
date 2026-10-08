import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(PROJECT_ROOT, 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'fundamental-debt-audit.json');

const SCAN_ROOTS = [
  'src/app',
  'supabase/functions/server',
  'scripts',
];

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'dev-dist',
  '.git',
  'File Review',
]);

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

const CHECKS = [
  {
    key: 'directSupabaseTableAccess',
    pattern: /\bsupabase\.from\s*\(/g,
    description: 'Direct table access that should be intentionally justified or moved behind a domain service/API.',
  },
  {
    key: 'directSupabaseStorageAccess',
    pattern: /\bsupabase\.storage\./g,
    description: 'Direct storage access that should be checked against upload/delete/public-read rules.',
  },
  {
    key: 'explicitAnyDebt',
    pattern: /(:\s*any\b|\bas\s+any\b|Record<string,\s*any>|<any>)/g,
    description: 'Explicit any usage that weakens type coverage.',
  },
  {
    key: 'typescriptIgnore',
    pattern: /@ts-(ignore|expect-error)/g,
    description: 'TypeScript suppression comments.',
  },
  {
    key: 'consoleLog',
    pattern: /\bconsole\.log\s*\(/g,
    description: 'Raw console.log calls outside structured command output.',
  },
];

function ensureArtifactDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function walkFiles(rootDir) {
  const absoluteRoot = path.join(PROJECT_ROOT, rootDir);
  if (!fs.existsSync(absoluteRoot)) return [];

  const results = [];
  const stack = [absoluteRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path.relative(PROJECT_ROOT, absolutePath);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) stack.push(absolutePath);
        continue;
      }

      if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
        results.push(relativePath);
      }
    }
  }

  return results.sort();
}

function countMatches(contents, pattern) {
  return [...contents.matchAll(pattern)].length;
}

function auditFile(relativePath) {
  const contents = fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
  const checks = Object.fromEntries(
    CHECKS.map((check) => [check.key, countMatches(contents, check.pattern)]),
  );
  const total = Object.values(checks).reduce((sum, count) => sum + count, 0);
  return { path: relativePath, total, checks };
}

function summarize(rows) {
  const totals = Object.fromEntries(CHECKS.map((check) => [check.key, 0]));

  for (const row of rows) {
    for (const key of Object.keys(totals)) {
      totals[key] += row.checks[key] ?? 0;
    }
  }

  const topFiles = rows
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.path.localeCompare(b.path))
    .slice(0, 20);

  return { totals, topFiles };
}

function main() {
  ensureArtifactDir();
  const files = SCAN_ROOTS.flatMap(walkFiles);
  const rows = files.map(auditFile);
  const summary = summarize(rows);
  const payload = {
    generatedAt: new Date().toISOString(),
    scannedRoots: SCAN_ROOTS,
    scannedFiles: files.length,
    checks: CHECKS.map(({ key, description }) => ({ key, description })),
    ...summary,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
}

main();

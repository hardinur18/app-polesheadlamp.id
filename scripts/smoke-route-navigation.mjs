import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5174';
const CHROME_PATH = resolveChromePath();
const PUPPETEER_IMPORT_TIMEOUT_MS = Number(process.env.PUPPETEER_IMPORT_TIMEOUT_MS || 30_000);
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'route-navigation-smoke.json');

const routes = [
  {
    path: '/login',
    expectedText: 'Restoration Headlamp',
    expectedFinalPath: '/login/',
    description: 'official login route',
  },
  {
    path: '/dashboard',
    expectedText: 'Restoration Headlamp',
    expectedFinalPath: '/login/',
    description: 'authenticated canonical route while logged out should redirect to login gate',
  },
  {
    path: '/orders',
    expectedText: 'Restoration Headlamp',
    expectedFinalPath: '/login/',
    description: 'direct canonical internal route should redirect to login gate while logged out',
  },
  {
    path: '/leads',
    expectedText: 'Restoration Headlamp',
    expectedFinalPath: '/login/',
    description: 'direct canonical internal route should redirect to login gate while logged out',
  },
  {
    path: '/app/orders',
    expectedText: 'Restoration Headlamp',
    expectedFinalPath: '/login/',
    description: 'legacy /app internal route should redirect to login gate while logged out',
  },
  {
    path: '/booking',
    expectedText: 'Booking',
    description: 'public booking route',
  },
];

function ensureArtifactDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const platformCandidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ],
  };

  const candidates = platformCandidates[process.platform] || [];
  const fileMatch = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (fileMatch) return fileMatch;

  if (process.platform === 'linux') {
    for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      try {
        return execFileSync('which', [command], { encoding: 'utf8' }).trim();
      } catch {
        // Try the next known binary name.
      }
    }
  }

  throw new Error('Chrome executable tidak ditemukan. Set CHROME_PATH=/path/to/chrome lalu jalankan ulang smoke test.');
}

async function loadPuppeteer() {
  let timeoutId;
  try {
    const module = await Promise.race([
      import('puppeteer-core'),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timed out loading puppeteer-core after ${PUPPETEER_IMPORT_TIMEOUT_MS}ms.`));
        }, PUPPETEER_IMPORT_TIMEOUT_MS);
      }),
    ]);
    return module.default || module;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function smokeRoute(page, route) {
  const url = new URL(route.path, BASE_URL).toString();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('body', { timeout: 45_000 });
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    { timeout: 45_000 },
    route.expectedText,
  );
  const finalPath = new URL(page.url()).pathname;
  const expectedFinalPath = route.expectedFinalPath || route.path;

  const normalizePath = (value) =>
    value !== '/' && value.endsWith('/') ? value.slice(0, -1) : value;

  if (normalizePath(finalPath) !== normalizePath(expectedFinalPath)) {
    throw new Error(`Expected final path ${expectedFinalPath}, got ${finalPath}`);
  }

  return {
    path: route.path,
    url,
    description: route.description,
    status: response?.status() ?? null,
    finalUrl: page.url(),
    expectedFinalPath,
    expectedText: route.expectedText,
    passed: true,
  };
}

async function main() {
  ensureArtifactDir();

  console.error('smoke: loading puppeteer');
  const puppeteer = await loadPuppeteer();
  console.error('smoke: launching browser');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(45_000);

  const results = [];
  try {
    for (const route of routes) {
      console.error(`smoke: ${route.path}`);
      try {
        results.push(await smokeRoute(page, route));
      } catch (error) {
        results.push({
          path: route.path,
          url: new URL(route.path, BASE_URL).toString(),
          description: route.description,
          finalUrl: page.url(),
          expectedText: route.expectedText,
          bodyPreview: await page
            .evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 300) || '')
            .catch(() => ''),
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await browser.close();
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: results,
    passed: results.every((result) => result.passed),
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  ensureArtifactDir();
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'phase1-visible-role-check.json');

const scenarios = [
  {
    role: 'Owner',
    checks: [
      { path: '/dashboard/', expected: ['Dashboard', 'Advertiser View', 'RHI System'] },
      { path: '/orders/', expected: ['Pesanan', 'Data Pesanan'] },
      { path: '/leads/', expected: ['Prospek', 'Data Prospek'] },
    ],
  },
  {
    role: 'CS',
    checks: [
      { path: '/dashboard/', expected: ['CS View', 'Performa CS', 'Dashboard'] },
      { path: '/leads/', expected: ['Prospek', 'Data Prospek'] },
      { path: '/orders/', expected: ['Pesanan', 'Data Pesanan'] },
    ],
  },
  {
    role: 'Teknisi',
    checks: [
      { path: '/technician/mobile/', expected: ['Jadwal', 'Teknisi', 'Pesanan'] },
      { path: '/orders/', expected: ['Pesanan', 'Data Pesanan'] },
      { path: '/dashboard/', expected: ['Dashboard', 'Teknisi'] },
    ],
  },
  {
    role: 'Finance',
    checks: [
      { path: '/dashboard/', expected: ['Dashboard', 'RHI System'] },
      { path: '/finance/report/', expected: ['Laporan', 'Operasional'] },
      { path: '/orders/', expected: ['Pesanan', 'Data Pesanan'] },
    ],
  },
  {
    role: 'Advertiser',
    checks: [
      { path: '/dashboard/', expected: ['Advertiser View', 'Dashboard'] },
      { path: '/ads/daily/', expected: ['Iklan Harian', 'Iklan'] },
      { path: '/leads/', expected: ['Prospek', 'Data Prospek'] },
    ],
  },
];

function ensureArtifactDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function loadPuppeteer() {
  const module = await import('puppeteer-core');
  return module.default || module;
}

function appUrl(pathname) {
  return new URL(pathname, BASE_URL).toString();
}

async function bodyPreview(page, length = 700) {
  return page
    .evaluate((previewLength) => document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, previewLength) || '', length)
    .catch(() => '');
}

async function clearBrowserSession(page) {
  await page.goto(appUrl('/login/'), { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {});
  const cookies = await page.cookies().catch(() => []);
  if (cookies.length) {
    await page.deleteCookie(...cookies).catch(() => {});
  }
}

async function waitForManualLogin(page, role, rl) {
  await page.goto(appUrl('/login/'), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('body', { timeout: 60_000 });
  console.log(`\n[${role}] Silakan login di Chrome yang terbuka.`);
  await rl.question(`[${role}] Setelah dashboard/halaman app terbuka, tekan Enter di sini untuk mulai validasi route. `);
}

async function checkRoute(page, role, check) {
  await page.goto(appUrl(check.path), { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('body', { timeout: 60_000 });
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const preview = await bodyPreview(page);
  const finalUrl = page.url();
  const finalPath = new URL(finalUrl).pathname;
  const matchedExpected = check.expected.some((text) => preview.includes(text));
  const failureSignals = [
    'Koneksi Profil Timeout',
    'Profil Login Belum Valid',
    'Akses Ditolak',
    'Restoration Headlamp Masuk untuk mengelola data operasional internal',
  ];
  const matchedFailure = failureSignals.find((signal) => preview.includes(signal));
  const thrownToProfile = finalPath.startsWith('/profile') && !check.path.startsWith('/profile');

  const passed = matchedExpected && !matchedFailure && !thrownToProfile;
  return {
    role,
    path: check.path,
    finalUrl,
    expected: check.expected,
    passed,
    matchedFailure: matchedFailure || null,
    thrownToProfile,
    bodyPreview: passed ? undefined : preview,
  };
}

async function main() {
  ensureArtifactDir();
  const rl = readline.createInterface({ input, output });
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      `--window-size=1500,1000`,
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(90_000);
  const results = [];

  try {
    for (const scenario of scenarios) {
      await clearBrowserSession(page);
      await rl.question(`\nTekan Enter untuk mulai cek role ${scenario.role}. `);
      await waitForManualLogin(page, scenario.role, rl);

      for (const check of scenario.checks) {
        console.log(`[${scenario.role}] Cek ${check.path}`);
        const result = await checkRoute(page, scenario.role, check);
        results.push(result);
        console.log(result.passed ? `  PASS ${check.path}` : `  FAIL ${check.path}`);
      }
    }
  } finally {
    const payload = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      passed: results.length > 0 && results.every((result) => result.passed),
      results,
    };
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\nHasil tersimpan: ${OUTPUT_PATH}`);
    console.log(JSON.stringify({ passed: payload.passed, total: results.length }, null, 2));
    await rl.close();
    await browser.close();
    if (!payload.passed) {
      process.exitCode = 1;
    }
  }
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

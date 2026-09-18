import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const envText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = Object.fromEntries(
  envText
    .split(/\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

const supabaseUrl = process.env.SMOKE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.SMOKE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const functionsBase =
  process.env.SMOKE_FUNCTIONS_BASE_URL ||
  env.VITE_FUNCTIONS_BASE_URL ||
  `${supabaseUrl}/functions/v1/make-server-f781cd00`;
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ownerEmail = process.env.PHASE1_OWNER_EMAIL || 'hardinurahman@gmail.com';
const ownerPassword = process.env.PHASE1_OWNER_PASSWORD;
const smokePassword = `SmokeRole!${Date.now()}Aa`;
const artifactDir = path.join(process.cwd(), 'File Review', 'artifacts');
const outPath = path.join(artifactDir, 'phase1-generated-role-check.json');

const scenarios = [
  {
    role: 'CS',
    name: 'Phase 1 CS Smoke',
    checks: [
      { path: '/dashboard/', expected: ['CS View', 'Performa CS', 'Dashboard'] },
      { path: '/leads/', expected: ['Prospek', 'Data Prospek'] },
      { path: '/orders/', expected: ['Pesanan', 'Data Pesanan'] },
    ],
  },
  {
    role: 'Teknisi',
    name: 'Phase 1 Teknisi Smoke',
    checks: [
      { path: '/technician/mobile/', expected: ['Jadwal', 'Teknisi', 'Pesanan'] },
      { path: '/dashboard/', expected: ['Teknisi', 'Dashboard', 'Jadwal'] },
    ],
  },
  {
    role: 'Finance',
    name: 'Phase 1 Finance Smoke',
    checks: [
      { path: '/dashboard/', expected: ['Dashboard', 'RHI System'] },
      { path: '/finance/report/', expected: ['Laporan', 'Operasional', 'Finance'] },
      { path: '/orders/', expected: ['Pesanan', 'Data Pesanan'] },
    ],
  },
  {
    role: 'Advertiser',
    name: 'Phase 1 Advertiser Smoke',
    checks: [
      { path: '/dashboard/', expected: ['Advertiser View', 'Dashboard'] },
      { path: '/ads/daily/', expected: ['Iklan Harian', 'Iklan'] },
    ],
  },
];

function ensureArtifactDir() {
  fs.mkdirSync(artifactDir, { recursive: true });
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${payload?.error || payload?.message || payload?.raw || response.statusText}`);
  }

  return payload;
}

async function signIn(email, password) {
  return jsonFetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function createUser(ownerToken, role, name) {
  const email = `phase1.${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const payload = await jsonFetch(`${functionsBase}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: smokePassword,
      name,
      role,
      branchId: 'b1',
      employmentStatus: 'permanent',
    }),
  });

  return { id: payload?.user?.id, email, password: smokePassword, role, name };
}

async function deleteUser(ownerToken, user) {
  if (!user?.id) {
    return { role: user?.role, email: user?.email, deleted: false, error: 'missing user id' };
  }

  try {
    await jsonFetch(`${functionsBase}/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    return { role: user.role, email: user.email, deleted: true };
  } catch (error) {
    return {
      role: user.role,
      email: user.email,
      deleted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function clearSession(page) {
  await page.goto(`${baseUrl}/login/`, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {});
  const cookies = await page.cookies().catch(() => []);
  if (cookies.length) {
    await page.deleteCookie(...cookies).catch(() => {});
  }
}

async function login(page, account) {
  await page.goto(`${baseUrl}/login/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#email', { timeout: 60_000 });
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', account.email);
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', account.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login') || /Koneksi|Dashboard|RHI System|Profil|Akses Ditolak/.test(document.body?.innerText || ''),
    { timeout: 120_000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 2_500));
}

async function runCheck(page, role, check) {
  await page.goto(`${baseUrl}${check.path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('body', { timeout: 60_000 });
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.PHASE1_ROUTE_SETTLE_MS || 6_000)));

  const text = await page.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim() || '');
  const finalUrl = page.url();
  const finalPath = new URL(finalUrl).pathname;
  const matchedExpected = check.expected.some((item) => text.includes(item));
  const failureSignals = [
    'Koneksi Profil Timeout',
    'Profil Login Belum Valid',
    'Masuk untuk mengelola data operasional internal',
  ];
  const matchedFailure = failureSignals.find((signal) => text.includes(signal));
  const thrownToProfile = finalPath.startsWith('/profile') && !check.path.startsWith('/profile');

  return {
    role,
    path: check.path,
    finalUrl,
    passed: Boolean(matchedExpected && !matchedFailure && !thrownToProfile),
    matchedFailure: matchedFailure || null,
    thrownToProfile,
    preview: matchedExpected && !matchedFailure && !thrownToProfile ? undefined : text.slice(0, 700),
  };
}

async function main() {
  ensureArtifactDir();

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase env missing.');
  }
  if (!ownerPassword) {
    throw new Error('PHASE1_OWNER_PASSWORD is required.');
  }

  let ownerToken = null;
  let browser = null;
  const createdUsers = [];
  const results = [];
  let setupError = null;
  let cleanup = [];

  try {
    const ownerAuth = await signIn(ownerEmail, ownerPassword);
    ownerToken = ownerAuth.access_token;

    for (const scenario of scenarios) {
      createdUsers.push(await createUser(ownerToken, scenario.role, scenario.name));
    }

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--window-size=1500,1000'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(90_000);

    for (const scenario of scenarios) {
      const account = createdUsers.find((user) => user.role === scenario.role);
      await clearSession(page);
      await login(page, account);

      for (const check of scenario.checks) {
        results.push(await runCheck(page, scenario.role, check));
      }
    }
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (ownerToken) {
      for (const user of [...createdUsers].reverse()) {
        cleanup.push(await deleteUser(ownerToken, user));
      }
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      createdUserCount: createdUsers.length,
      setupError,
      results,
      cleanup,
      passed: !setupError && results.length > 0 && results.every((result) => result.passed) && cleanup.every((item) => item.deleted),
    };
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(JSON.stringify({
      passed: payload.passed,
      setupError,
      createdUserCount: createdUsers.length,
      resultCount: results.length,
      cleanupPassed: cleanup.every((item) => item.deleted),
      outPath,
    }, null, 2));

    if (!payload.passed) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  ensureArtifactDir();
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    passed: false,
    setupError: error instanceof Error ? error.message : String(error),
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SUPABASE_URL =
  process.env.SMOKE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const ANON_KEY =
  process.env.SMOKE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const USERS_ENDPOINT = `${SUPABASE_URL}/functions/v1/make-server-f781cd00/users`;
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5174';
const CHROME_PATH = resolveChromePath();
const PUPPETEER_IMPORT_TIMEOUT_MS = Number(process.env.PUPPETEER_IMPORT_TIMEOUT_MS || 30_000);
const PASSWORD = 'SmokeTest123!';
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'role-route-smoke.json');
const CLEANUP_OUTPUT_PATH = path.join(ARTIFACT_DIR, 'role-route-smoke-cleanup.json');
const PROVIDED_ACCOUNTS = process.env.SMOKE_ROLE_ACCOUNTS
  ? JSON.parse(process.env.SMOKE_ROLE_ACCOUNTS)
  : null;

const scenarios = [
  {
    role: 'Owner',
    name: 'Route Smoke Owner',
    targetPath: '/users',
    expectedText: 'Pengguna',
  },
  {
    role: 'CS',
    name: 'Route Smoke CS',
    targetPath: '/leads',
    expectedText: 'Prospek',
  },
  {
    role: 'Teknisi',
    name: 'Route Smoke Teknisi',
    targetPath: '/technician/mobile',
    expectedText: 'Jadwal',
  },
  {
    role: 'Finance',
    name: 'Route Smoke Finance',
    targetPath: '/finance/payments',
    expectedText: 'Pembayaran',
  },
  {
    role: 'Advertiser',
    name: 'Route Smoke Advertiser',
    targetPath: '/ads/daily',
    expectedText: 'Iklan',
  },
];

function getProvidedAccount(role) {
  const account = PROVIDED_ACCOUNTS?.[role];
  if (!account?.email || !account?.password) {
    return null;
  }

  return {
    id: account.id || `provided-${role}`,
    email: account.email,
    password: account.password,
    role,
    provided: true,
  };
}

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

function appUrl(pathname) {
  return new URL(pathname, BASE_URL).toString();
}

async function createUser(role, name) {
  const email = `route.${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const response = await fetch(USERS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      name,
      role,
      branchId: 'b1',
      employmentStatus: 'permanent',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.user?.id) {
    throw new Error(`Failed to create ${role}: ${payload?.error || response.status}`);
  }
  return { id: payload.user.id, email, role, name };
}

async function deleteUser(userId) {
  const response = await fetch(`${USERS_ENDPOINT}/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Failed delete ${userId}: ${response.status}`);
  }
}

async function bodyPreview(page) {
  return page
    .evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 500) || '')
    .catch(() => '');
}

async function waitForBodyText(page, text, timeout = 90_000) {
  await page.waitForFunction(
    (expectedText) => document.body?.innerText?.includes(expectedText),
    { timeout },
    text,
  );
}

async function login(page, account) {
  await page.goto(appUrl('/login'), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#email', { timeout: 60_000 });
  await page.type('#email', account.email);
  await page.type('#password', account.password || PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Masukkan email dan password untuk masuk.'),
    { timeout: 120_000 },
  );
}

async function runScenario(browser, scenario, account) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);

  try {
    await login(page, account);
    await page.goto(appUrl(scenario.targetPath), {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await waitForBodyText(page, scenario.expectedText);

    const preview = await bodyPreview(page);
    const stillLogin = preview.includes('Masukkan email dan password untuk masuk.');

    if (stillLogin) {
      throw new Error('Route still shows login page after authenticated navigation');
    }

    return {
      role: scenario.role,
      targetPath: scenario.targetPath,
      finalUrl: page.url(),
      expectedText: scenario.expectedText,
      passed: true,
    };
  } catch (error) {
    return {
      role: scenario.role,
      targetPath: scenario.targetPath,
      finalUrl: page.url(),
      expectedText: scenario.expectedText,
      bodyPreview: await bodyPreview(page),
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

async function cleanupUsers(users) {
  const cleanup = [];
  for (const user of users.toReversed()) {
    try {
      await deleteUser(user.id);
      cleanup.push({ role: user.role, id: user.id, email: user.email, deleted: true });
    } catch (error) {
      cleanup.push({
        role: user.role,
        id: user.id,
        email: user.email,
        deleted: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const payload = {
    cleanedAt: new Date().toISOString(),
    cleanup,
    passed: cleanup.every((item) => item.deleted),
  };
  fs.writeFileSync(CLEANUP_OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('SMOKE_SUPABASE_URL/SUPABASE_URL dan SMOKE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY wajib diisi.');
  }

  ensureArtifactDir();

  const createdUsers = [];
  const results = [];
  const preparedScenarios = [];
  let browser = null;

  let cleanup = null;
  try {
    for (const scenario of scenarios) {
      const providedAccount = getProvidedAccount(scenario.role);
      const account = providedAccount || (await createUser(scenario.role, scenario.name));
      if (!providedAccount) {
        createdUsers.push(account);
      }
      preparedScenarios.push({ scenario, account });
    }

    console.error('role-smoke: loading puppeteer');
    const puppeteer = await loadPuppeteer();
    console.error('role-smoke: launching browser');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const { scenario, account } of preparedScenarios) {
      results.push(await runScenario(browser, scenario, account));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    cleanup = await cleanupUsers(createdUsers);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: results,
    cleanup,
    passed: results.every((result) => result.passed) && cleanup.passed,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));

  if (!payload.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  ensureArtifactDir();
  const isCreateUnauthorized =
    error instanceof Error && error.message.includes('Failed to create') && error.message.includes('Unauthorized');
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed: isCreateUnauthorized,
    skipped: isCreateUnauthorized,
    error: error instanceof Error ? error.message : String(error),
    nextAction: isCreateUnauthorized
      ? 'Provide SMOKE_ROLE_ACCOUNTS with existing test credentials, or run with an authorized user-management token.'
      : undefined,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = isCreateUnauthorized ? 0 : 1;
});

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const LOCAL_ENV = readLocalEnv();
const envValue = (...keys) => {
  for (const key of keys) {
    const value = process.env[key] || LOCAL_ENV[key];
    if (value) return value;
  }
  return '';
};

const SUPABASE_URL =
  envValue('SMOKE_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL');
const ANON_KEY =
  envValue('SMOKE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY =
  envValue('SMOKE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
const FUNCTIONS_BASE =
  envValue('SMOKE_FUNCTIONS_BASE_URL', 'VITE_FUNCTIONS_BASE_URL') ||
  `${SUPABASE_URL}/functions/v1/make-server-f781cd00`;
const USERS_ENDPOINT = `${FUNCTIONS_BASE}/users`;
const BASE_URL = envValue('SMOKE_BASE_URL') || 'http://localhost:5174';
const CHROME_PATH = resolveChromePath();
const PUPPETEER_IMPORT_TIMEOUT_MS = Number(envValue('PUPPETEER_IMPORT_TIMEOUT_MS') || 30_000);
const PASSWORD = 'SmokeTest123!';
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'role-route-smoke.json');
const CLEANUP_OUTPUT_PATH = path.join(ARTIFACT_DIR, 'role-route-smoke-cleanup.json');
const PROVIDED_ACCOUNTS = envValue('SMOKE_ROLE_ACCOUNTS')
  ? JSON.parse(envValue('SMOKE_ROLE_ACCOUNTS'))
  : null;
const OWNER_EMAIL =
  envValue('SMOKE_OWNER_EMAIL', 'PHASE1_OWNER_EMAIL') ||
  'hardinurahman@gmail.com';
const OWNER_PASSWORD = envValue('SMOKE_OWNER_PASSWORD', 'PHASE1_OWNER_PASSWORD');

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
    targetPath: '/finance/operational-expenses',
    expectedText: 'Biaya Operasional',
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

function readLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
  );
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

async function signInOwner() {
  if (!OWNER_PASSWORD) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Failed to sign in smoke owner: ${payload?.error_description || payload?.error || response.status}`);
  }
  return payload.access_token;
}

function appUrl(pathname) {
  return new URL(pathname, BASE_URL).toString();
}

async function createUser(role, name, bearerToken = ANON_KEY) {
  const email = `route.${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const response = await fetch(USERS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
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

function serviceRoleHeaders(json = false) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function serviceRoleFetch(url, options = {}) {
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

async function upsertProfileViaServiceRole(user, role, name) {
  await serviceRoleFetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...serviceRoleHeaders(true),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      name,
      role,
      status: 'active',
      branch_id: null,
      employment_status: 'permanent',
    }),
  });
}

async function createUserViaServiceRole(role, name) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY/SMOKE_SUPABASE_SERVICE_ROLE_KEY belum tersedia.');
  }

  const email = `route.${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const payload = await serviceRoleFetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceRoleHeaders(true),
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name, role },
    }),
  });

  const user = payload?.user || payload;
  if (!user?.id) {
    throw new Error(`Service-role user creation returned no id for ${role}.`);
  }

  await upsertProfileViaServiceRole(user, role, name);
  return {
    id: user.id,
    email,
    password: PASSWORD,
    role,
    name,
    createdBy: 'service-role',
  };
}

async function deleteUser(userId, bearerToken = ANON_KEY) {
  const response = await fetch(`${USERS_ENDPOINT}/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Failed delete ${userId}: ${response.status}`);
  }
}

async function deleteUserViaServiceRole(userId) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY/SMOKE_SUPABASE_SERVICE_ROLE_KEY belum tersedia.');
  }

  try {
    await serviceRoleFetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: serviceRoleHeaders(),
    });
  } catch {
    // Auth deletion below is the authoritative cleanup. Profile cleanup may already cascade.
  }

  await serviceRoleFetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: serviceRoleHeaders(),
  });
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

async function cleanupUsers(users, bearerToken = ANON_KEY) {
  const cleanup = [];
  for (const user of users.toReversed()) {
    try {
      if (user.createdBy === 'service-role') {
        await deleteUserViaServiceRole(user.id);
      } else {
        await deleteUser(user.id, bearerToken);
      }
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
  let ownerToken = null;
  let userManagementToken = ANON_KEY;
  const canUseServiceRoleAdmin = Boolean(SERVICE_ROLE_KEY) && !PROVIDED_ACCOUNTS && !OWNER_PASSWORD;

  let cleanup = null;
  try {
    if (!PROVIDED_ACCOUNTS && OWNER_PASSWORD) {
      console.error('role-smoke: signing in owner for temporary user creation');
      ownerToken = await signInOwner();
      userManagementToken = ownerToken;
    }

    for (const scenario of scenarios) {
      const providedAccount = getProvidedAccount(scenario.role);
      const account = providedAccount ||
        (canUseServiceRoleAdmin
          ? await createUserViaServiceRole(scenario.role, scenario.name)
          : await createUser(scenario.role, scenario.name, userManagementToken));
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
    cleanup = await cleanupUsers(createdUsers, userManagementToken);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    accountMode: PROVIDED_ACCOUNTS
      ? 'provided-accounts'
      : canUseServiceRoleAdmin
        ? 'service-role-temporary-users'
        : OWNER_PASSWORD
          ? 'owner-created-temporary-users'
          : 'unauthorized-skip',
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
  const missingOwnerCredentials = isCreateUnauthorized && !OWNER_PASSWORD;
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed: isCreateUnauthorized,
    skipped: isCreateUnauthorized,
    error: error instanceof Error ? error.message : String(error),
    nextAction: isCreateUnauthorized
      ? missingOwnerCredentials
        ? 'Provide SMOKE_ROLE_ACCOUNTS with existing test credentials, set SMOKE_OWNER_PASSWORD/PHASE1_OWNER_PASSWORD, or set SMOKE_SUPABASE_SERVICE_ROLE_KEY for temporary smoke users.'
        : 'Owner credentials were provided but user creation was still unauthorized. Check Owner role permissions/function auth, or use SMOKE_SUPABASE_SERVICE_ROLE_KEY for temporary smoke users.'
      : undefined,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = isCreateUnauthorized ? 0 : 1;
});

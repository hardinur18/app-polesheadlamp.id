import fs from 'node:fs';
import path from 'node:path';

import puppeteer from 'puppeteer-core';

const SUPABASE_URL =
  process.env.PERF_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const ANON_KEY =
  process.env.PERF_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const USERS_ENDPOINT = `${SUPABASE_URL}/functions/v1/make-server-f781cd00/users`;
const PREVIEW_URL = 'http://localhost:4173';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASSWORD = 'SmokeTest123!';
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'mobile-chrome-performance-baseline.json');

const DEVICE = {
  width: 412,
  height: 915,
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
};

const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((750 * 1024) / 8),
  connectionType: 'cellular4g',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createUser(role, name) {
  const email = `perf.${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function clickByText(page, text, exact = false) {
  const clicked = await page.evaluate(
    ({ text, exact }) => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a, [role="button"], [role="menuitem"], [data-radix-collection-item]',
        ),
      );
      const target = candidates.find((element) => {
        const content = normalize(element.innerText || element.textContent || '');
        return exact ? content === text : content.includes(text);
      });
      if (!target) return false;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.click();
      return true;
    },
    { text, exact },
  );

  if (!clicked) {
    throw new Error(`Could not find clickable text: ${text}`);
  }
}

async function waitForText(page, text, timeout = 60_000) {
  await page.waitForFunction(
    (expected) => {
      if (!document.body) return false;
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      return normalize(document.body.innerText).includes(normalize(expected));
    },
    { timeout },
    text,
  );
}

async function preparePageInContext(context) {
  const page = await context.newPage();
  await page.setViewport({
    width: DEVICE.width,
    height: DEVICE.height,
    deviceScaleFactor: DEVICE.deviceScaleFactor,
    isMobile: DEVICE.isMobile,
    hasTouch: DEVICE.hasTouch,
  });
  await page.setUserAgent(DEVICE.userAgent);
  await page.evaluateOnNewDocument(() => {
    window.__perfBaselineStore = {
      longTasks: [],
      lcpEntries: [],
      cls: 0,
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfBaselineStore.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfBaselineStore.lcpEntries.push({
            startTime: entry.startTime,
            size: entry.size || 0,
          });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__perfBaselineStore.cls += entry.value || 0;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });

  const client = await page.target().createCDPSession();
  await client.send('Performance.enable');
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', NETWORK);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  page.setDefaultTimeout(60_000);

  return { page, client };
}

async function prepareIsolatedPage(browser) {
  const context = await browser.createBrowserContext();
  const session = await preparePageInContext(context);
  return { context, ...session };
}

function metricsArrayToMap(metrics) {
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
}

async function getSnapshot(page, client) {
  const perfMetrics = metricsArrayToMap((await client.send('Performance.getMetrics')).metrics || []);
  const runtime = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((entry) => entry.name === 'first-contentful-paint');
    const resources = performance.getEntriesByType('resource');
    const transferSize = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
    const decodedBodySize = resources.reduce(
      (sum, resource) => sum + (resource.decodedBodySize || 0),
      0,
    );
    const longTasks = window.__perfBaselineStore?.longTasks || [];
    const longTaskTotal = longTasks.reduce((sum, entry) => sum + entry.duration, 0);
    const lcpEntries = window.__perfBaselineStore?.lcpEntries || [];
    const lastLcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null;

    return {
      now: performance.now(),
      nav: nav
        ? {
            domContentLoaded: nav.domContentLoadedEventEnd,
            loadEventEnd: nav.loadEventEnd,
            responseEnd: nav.responseEnd,
          }
        : null,
      fcp: fcp?.startTime || null,
      lcp: lastLcp,
      cls: window.__perfBaselineStore?.cls || 0,
      resourceCount: resources.length,
      transferSize,
      decodedBodySize,
      longTaskCount: longTasks.length,
      longTaskTotal,
    };
  });

  return {
    ...runtime,
    scriptDuration: perfMetrics.ScriptDuration || 0,
    taskDuration: perfMetrics.TaskDuration || 0,
    layoutDuration: perfMetrics.LayoutDuration || 0,
    recalcStyleDuration: perfMetrics.RecalcStyleDuration || 0,
    jsHeapUsedSize: perfMetrics.JSHeapUsedSize || 0,
    nodes: perfMetrics.Nodes || 0,
  };
}

function diffSnapshot(before, after) {
  return {
    visibleDurationMs: Number((after.now - before.now).toFixed(1)),
    resourceCountDelta: after.resourceCount - before.resourceCount,
    transferSizeKbDelta: Number(((after.transferSize - before.transferSize) / 1024).toFixed(1)),
    decodedBodyKbDelta: Number(
      ((after.decodedBodySize - before.decodedBodySize) / 1024).toFixed(1),
    ),
    longTaskCountDelta: after.longTaskCount - before.longTaskCount,
    longTaskTotalMsDelta: Number((after.longTaskTotal - before.longTaskTotal).toFixed(1)),
    scriptDurationMsDelta: Number(((after.scriptDuration - before.scriptDuration) * 1000).toFixed(1)),
    taskDurationMsDelta: Number(((after.taskDuration - before.taskDuration) * 1000).toFixed(1)),
    layoutDurationMsDelta: Number(((after.layoutDuration - before.layoutDuration) * 1000).toFixed(1)),
    recalcStyleDurationMsDelta: Number(
      ((after.recalcStyleDuration - before.recalcStyleDuration) * 1000).toFixed(1),
    ),
    jsHeapUsedMbEnd: Number((after.jsHeapUsedSize / (1024 * 1024)).toFixed(2)),
    nodesEnd: Math.round(after.nodes),
  };
}

async function runScenario(results, id, page, runner) {
  try {
    const result = await runner();
    results.push({ status: 'pass', ...result });
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, `perf-debug-${id}.png`),
          fullPage: true,
        });
      } catch {}
    }

    results.push({
      id,
      status: 'fail',
      error: error.message,
    });
  }
}

async function measureColdRoute(browser, routePath, expectedText, id, label) {
  const { context, page, client } = await prepareIsolatedPage(browser);
  try {
    await page.goto(`${PREVIEW_URL}${routePath}`, { waitUntil: 'domcontentloaded' });
    await waitForText(page, expectedText);
    await sleep(1_500);
    const snapshot = await getSnapshot(page, client);

    return {
      id,
      label,
      type: 'cold-route',
      routePath,
      expectedText,
      metrics: {
        domContentLoadedMs: snapshot.nav ? Number(snapshot.nav.domContentLoaded.toFixed(1)) : null,
        loadEventEndMs: snapshot.nav ? Number(snapshot.nav.loadEventEnd.toFixed(1)) : null,
        responseEndMs: snapshot.nav ? Number(snapshot.nav.responseEnd.toFixed(1)) : null,
        fcpMs: snapshot.fcp ? Number(snapshot.fcp.toFixed(1)) : null,
        lcpMs: snapshot.lcp ? Number(snapshot.lcp.toFixed(1)) : null,
        cls: Number(snapshot.cls.toFixed(4)),
        resourceCount: snapshot.resourceCount,
        transferSizeKb: Number((snapshot.transferSize / 1024).toFixed(1)),
        decodedBodyKb: Number((snapshot.decodedBodySize / 1024).toFixed(1)),
        longTaskCount: snapshot.longTaskCount,
        longTaskTotalMs: Number(snapshot.longTaskTotal.toFixed(1)),
        scriptDurationMs: Number((snapshot.scriptDuration * 1000).toFixed(1)),
        taskDurationMs: Number((snapshot.taskDuration * 1000).toFixed(1)),
        layoutDurationMs: Number((snapshot.layoutDuration * 1000).toFixed(1)),
        recalcStyleDurationMs: Number((snapshot.recalcStyleDuration * 1000).toFixed(1)),
        jsHeapUsedMb: Number((snapshot.jsHeapUsedSize / (1024 * 1024)).toFixed(2)),
        nodes: Math.round(snapshot.nodes),
      },
    };
  } finally {
    await context.close();
  }
}

async function measureTransition(page, client, id, label, expectedText, action) {
  const before = await getSnapshot(page, client);
  await action();
  await waitForText(page, expectedText, 90_000);
  await sleep(2_000);
  const after = await getSnapshot(page, client);

  return {
    id,
    label,
    type: 'spa-transition',
    expectedText,
    metrics: diffSnapshot(before, after),
  };
}

async function loginOwner(page, client, account) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email');
  const before = await getSnapshot(page, client);
  await page.type('#email', account.email);
  await page.type('#password', PASSWORD);
  await Promise.allSettled([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15_000 }),
  ]);
  await waitForText(page, 'Profil Saya', 90_000);
  await sleep(2_000);
  const after = await getSnapshot(page, client);

  return {
    id: 'owner-login-shell',
    label: 'Owner login to shell',
    type: 'auth-flow',
    expectedText: 'Profil Saya',
    metrics: diffSnapshot(before, after),
  };
}

async function loginTeknisi(page, client, account) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email');
  const before = await getSnapshot(page, client);
  await page.type('#email', account.email);
  await page.type('#password', PASSWORD);
  await Promise.allSettled([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15_000 }),
  ]);
  await waitForText(page, 'Profil Saya', 90_000);
  await sleep(2_000);
  const after = await getSnapshot(page, client);

  return {
    id: 'teknisi-login-shell',
    label: 'Teknisi login to shell',
    type: 'auth-flow',
    expectedText: 'Profil Saya',
    metrics: diffSnapshot(before, after),
  };
}

async function run() {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('PERF_SUPABASE_URL/SUPABASE_URL dan PERF_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY wajib diisi.');
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const results = [];
  const createdUsers = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    defaultViewport: null,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  try {
    await runScenario(results, 'public-root-login', null, () =>
      measureColdRoute(browser, '/', 'Masuk', 'public-root-login', 'Public root login'),
    );
    await runScenario(results, 'public-booking', null, () =>
      measureColdRoute(
        browser,
        '/booking',
        'Formulir Booking Service',
        'public-booking',
        'Public booking',
      ),
    );
    await runScenario(results, 'public-payment-preview', null, () =>
      measureColdRoute(
        browser,
        '/payment-gateway-preview',
        'PAYMENT GATEWAY PREVIEW',
        'public-payment-preview',
        'Payment gateway preview',
      ),
    );

    const owner = await createUser('Owner', 'Perf Owner');
    const teknisi = await createUser('Teknisi', 'Perf Teknisi');
    createdUsers.push(owner, teknisi);

    const ownerSession = await prepareIsolatedPage(browser);
    try {
      await runScenario(results, 'owner-login-shell', ownerSession.page, () =>
        loginOwner(ownerSession.page, ownerSession.client, owner),
      );
      await runScenario(results, 'owner-dashboard', ownerSession.page, () =>
        measureTransition(
          ownerSession.page,
          ownerSession.client,
          'owner-dashboard',
          'Owner dashboard',
          'Dashboard',
          async () => {
            await clickByText(ownerSession.page, 'Home', true);
          },
        ),
      );
      await runScenario(results, 'owner-prospek', ownerSession.page, () =>
        measureTransition(
          ownerSession.page,
          ownerSession.client,
          'owner-prospek',
          'Owner prospek',
          'Kotak Masuk Prospek',
          async () => {
            await clickByText(ownerSession.page, 'Prospek', true);
          },
        ),
      );
      await runScenario(results, 'owner-orders', ownerSession.page, () =>
        measureTransition(
          ownerSession.page,
          ownerSession.client,
          'owner-orders',
          'Owner pesanan',
          'Pesanan & Layanan',
          async () => {
            await clickByText(ownerSession.page, 'Pesanan', true);
          },
        ),
      );
      await runScenario(results, 'owner-monitoring-performance', ownerSession.page, () =>
        measureTransition(
          ownerSession.page,
          ownerSession.client,
          'owner-monitoring-performance',
          'Owner monitoring performance',
          'Monitoring Performance',
          async () => {
            await clickByText(ownerSession.page, 'Menu', true);
            await sleep(600);
            await clickByText(ownerSession.page, 'Monitoring Perf.');
          },
        ),
      );
      await runScenario(results, 'owner-payroll', ownerSession.page, () =>
        measureTransition(
          ownerSession.page,
          ownerSession.client,
          'owner-payroll',
          'Owner payroll',
          'Payroll & Komisi',
          async () => {
            await clickByText(ownerSession.page, 'Menu', true);
            await sleep(600);
            await clickByText(ownerSession.page, 'Payroll & Gaji');
          },
        ),
      );
      await runScenario(results, 'owner-marketing-os-conversation-hub', ownerSession.page, () =>
        measureTransition(
          ownerSession.page,
          ownerSession.client,
          'owner-marketing-os-conversation-hub',
          'Owner Marketing OS Conversation Hub',
          'Conversation Hub',
          async () => {
            await clickByText(ownerSession.page, 'Menu', true);
            await sleep(600);
            await clickByText(ownerSession.page, 'Marketing OS');
            await sleep(500);
            await clickByText(ownerSession.page, 'Conversation Hub');
          },
        ),
      );
    } finally {
      await ownerSession.context.close();
    }

    const teknisiSession = await prepareIsolatedPage(browser);
    try {
      await runScenario(results, 'teknisi-login-shell', teknisiSession.page, () =>
        loginTeknisi(teknisiSession.page, teknisiSession.client, teknisi),
      );
      await runScenario(results, 'teknisi-mobile', teknisiSession.page, () =>
        measureTransition(
          teknisiSession.page,
          teknisiSession.client,
          'teknisi-mobile',
          'Teknisi mobile',
          'Daftar Kunjungan',
          async () => {
            await clickByText(teknisiSession.page, 'Jadwal Saya', true).catch(() => {});
          },
        ),
      );
    } finally {
      await teknisiSession.context.close();
    }
  } finally {
    await browser.close();
    for (const user of createdUsers.reverse()) {
      try {
        await deleteUser(user.id);
      } catch (error) {
        console.error(`Cleanup failed for ${user.email}: ${error.message}`);
      }
    }
  }

  const summary = {
    measuredAt: new Date().toISOString(),
    environment: {
      previewUrl: PREVIEW_URL,
      emulation: {
        viewport: `${DEVICE.width}x${DEVICE.height}`,
        deviceScaleFactor: DEVICE.deviceScaleFactor,
        cpuThrottleRate: 4,
        network: NETWORK,
      },
      note: 'Desktop Chrome headless with Android-style mobile emulation. Indicative baseline only, not a real-device field measurement.',
    },
    scenarios: results,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_messaging',
  'instagram_manage_messages',
  'instagram_basic',
];

const REQUIRED_DM_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_messaging',
  'instagram_manage_messages',
];

function parseArgs(argv) {
  const args = {
    envFile: path.resolve(process.cwd(), 'supabase/functions/.env.local'),
    writeEnv: false,
    exchangeLongLived: true,
    timeoutSeconds: 300,
    pollMs: 2000,
    redirectUri: 'https://www.facebook.com/connect/login_success.html',
    graphVersion: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--env-file') {
      args.envFile = path.resolve(process.cwd(), argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--write-env') {
      args.writeEnv = true;
      continue;
    }
    if (value === '--no-exchange') {
      args.exchangeLongLived = false;
      continue;
    }
    if (value === '--timeout-seconds') {
      args.timeoutSeconds = Number(argv[index + 1] || '300');
      index += 1;
      continue;
    }
    if (value === '--poll-ms') {
      args.pollMs = Number(argv[index + 1] || '2000');
      index += 1;
      continue;
    }
    if (value === '--redirect-uri') {
      args.redirectUri = argv[index + 1] || args.redirectUri;
      index += 1;
      continue;
    }
    if (value === '--graph-version') {
      args.graphVersion = argv[index + 1] || null;
      index += 1;
    }
  }

  return args;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file tidak ditemukan: ${filePath}`);
  }

  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    values[key] = rest.join('=').trim();
  }

  return values;
}

function requireValue(values, key) {
  const value = values[key]?.trim();
  if (!value) {
    throw new Error(`${key} belum diatur di env file.`);
  }
  return value;
}

function createAppSecretProof(appSecret, accessToken) {
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

async function fetchMetaJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Meta request gagal (${response.status})`);
  }
  return payload;
}

function createOAuthUrl({ appId, redirectUri, scopes, graphVersion, state }) {
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(','));
  url.searchParams.set('auth_type', 'rerequest');
  url.searchParams.set('display', 'popup');
  url.searchParams.set('state', state);
  return url.toString();
}

function runAppleScript(script) {
  const result = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'AppleScript gagal dijalankan.');
  }
  return (result.stdout || '').trim();
}

function openOAuthTab(url) {
  const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  runAppleScript(`
tell application "Google Chrome"
  activate
  tell front window
    make new tab with properties {URL:"${escapedUrl}"}
  end tell
end tell
`);
}

function listChromeTabs() {
  const output = runAppleScript(`
set outText to ""
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      set outText to outText & (title of t as text) & "<<<TABURL>>>" & (URL of t as text) & linefeed
    end repeat
  end repeat
end tell
return outText
`);

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pivot = line.indexOf('<<<TABURL>>>');
      if (pivot === -1) {
        return { title: '', url: line };
      }
      return {
        title: line.slice(0, pivot),
        url: line.slice(pivot + '<<<TABURL>>>'.length),
      };
    });
}

function parseOAuthResult(url) {
  const parsed = new URL(url);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '';
  const params = new URLSearchParams(parsed.search.slice(1) || hash);
  return {
    code: params.get('code') || '',
    grantedScopes: (params.get('granted_scopes') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    expiresIn: Number(params.get('expires_in') || '0') || null,
    error: params.get('error') || params.get('error_reason') || '',
    errorDescription: params.get('error_description') || '',
    state: params.get('state') || '',
  };
}

async function waitForOAuthRedirect({ state, timeoutSeconds, pollMs }) {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    const tabs = listChromeTabs();
    for (const tab of tabs) {
      if (!tab.url.includes(state)) continue;
      if (!tab.url.includes('code=') && !tab.url.includes('error=')) continue;
      try {
        return { ...tab, ...parseOAuthResult(tab.url) };
      } catch {
        continue;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const candidate = listChromeTabs().find((tab) => tab.title.includes('Masuk dengan Facebook'));
  if (candidate) {
    throw new Error(
      'Prompt OAuth masih terbuka di Chrome. Klik "Lanjutkan" atau "Izinkan" pada tab "Masuk dengan Facebook", lalu jalankan lagi command ini.',
    );
  }

  throw new Error('Timeout menunggu redirect OAuth dari Facebook.');
}

async function exchangeLongLivedToken({ appId, appSecret, shortLivedToken, graphVersion }) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('fb_exchange_token', shortLivedToken);
  return fetchMetaJson(url.toString());
}

async function exchangeCodeForToken({ appId, appSecret, code, redirectUri, graphVersion }) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  return fetchMetaJson(url.toString());
}

async function debugToken({ appId, appSecret, accessToken }) {
  const url = new URL('https://graph.facebook.com/debug_token');
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', `${appId}|${appSecret}`);
  return fetchMetaJson(url.toString());
}

async function fetchAccounts({ graphVersion, appSecret, accessToken }) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
  url.searchParams.set(
    'fields',
    'id,name,access_token,tasks,instagram_business_account{id,username,name}',
  );
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('appsecret_proof', createAppSecretProof(appSecret, accessToken));
  return fetchMetaJson(url.toString());
}

async function testConversations({ graphVersion, appSecret, page }) {
  const token = page.access_token;
  const pageUrl = new URL(`https://graph.facebook.com/${graphVersion}/${page.id}/conversations`);
  pageUrl.searchParams.set('platform', 'messenger');
  pageUrl.searchParams.set('fields', 'id,updated_time,message_count');
  pageUrl.searchParams.set('limit', '5');
  pageUrl.searchParams.set('access_token', token);
  pageUrl.searchParams.set('appsecret_proof', createAppSecretProof(appSecret, token));

  const pageResponse = await fetch(pageUrl);
  const pagePayload = await pageResponse.json().catch(() => ({}));

  let igResult = null;
  if (page.instagram_business_account?.id) {
    const igUrl = new URL(
      `https://graph.facebook.com/${graphVersion}/${page.instagram_business_account.id}/conversations`,
    );
    igUrl.searchParams.set('platform', 'instagram');
    igUrl.searchParams.set('fields', 'id,updated_time,message_count');
    igUrl.searchParams.set('limit', '5');
    igUrl.searchParams.set('access_token', token);
    igUrl.searchParams.set('appsecret_proof', createAppSecretProof(appSecret, token));
    const igResponse = await fetch(igUrl);
    const igPayload = await igResponse.json().catch(() => ({}));
    igResult = {
      status: igResponse.status,
      error: igPayload?.error?.message || null,
      count: Array.isArray(igPayload?.data) ? igPayload.data.length : null,
      instagramUsername: page.instagram_business_account.username || null,
    };
  }

  return {
    pageId: page.id,
    pageName: page.name,
    messenger: {
      status: pageResponse.status,
      error: pagePayload?.error?.message || null,
      count: Array.isArray(pagePayload?.data) ? pagePayload.data.length : null,
    },
    instagram: igResult,
  };
}

function writeEnvValue(filePath, key, value) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) updated.push(`${key}=${value}`);
  fs.writeFileSync(filePath, `${updated.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const values = readEnvFile(args.envFile);
  const appId = requireValue(values, 'META_APP_ID');
  const appSecret = requireValue(values, 'META_APP_SECRET');
  const graphVersion = args.graphVersion || values.META_GRAPH_VERSION?.trim() || 'v25.0';
  const state = `meta-dm-${Date.now()}`;
  const oauthUrl = createOAuthUrl({
    appId,
    redirectUri: args.redirectUri,
    scopes: DEFAULT_SCOPES,
    graphVersion,
    state,
  });

  console.log('Membuka OAuth role-test di Google Chrome...');
  console.log('Jika prompt muncul, klik "Lanjutkan" atau "Izinkan".');
  openOAuthTab(oauthUrl);

  const oauthResult = await waitForOAuthRedirect({
    state,
    timeoutSeconds: args.timeoutSeconds,
    pollMs: args.pollMs,
  });

  if (oauthResult.error) {
    throw new Error(oauthResult.errorDescription || oauthResult.error);
  }
  if (!oauthResult.code) {
    throw new Error('OAuth redirect berhasil, tetapi authorization code tidak ditemukan.');
  }

  const codeExchange = await exchangeCodeForToken({
    appId,
    appSecret,
    code: oauthResult.code,
    redirectUri: args.redirectUri,
    graphVersion,
  });

  let runtimeToken = codeExchange.access_token || '';
  if (!runtimeToken) {
    throw new Error('Gagal menukar authorization code menjadi user access token.');
  }
  let exchangedExpiresIn = null;
  if (args.exchangeLongLived) {
    const exchanged = await exchangeLongLivedToken({
      appId,
      appSecret,
      shortLivedToken: runtimeToken,
      graphVersion,
    });
    if (exchanged.access_token) {
      runtimeToken = exchanged.access_token;
      exchangedExpiresIn = exchanged.expires_in || null;
    }
  }

  const debugPayload = await debugToken({
    appId,
    appSecret,
    accessToken: runtimeToken,
  });
  const scopes = Array.isArray(debugPayload?.data?.scopes) ? debugPayload.data.scopes : [];
  const accountsPayload = await fetchAccounts({
    graphVersion,
    appSecret,
    accessToken: runtimeToken,
  });
  const pages = Array.isArray(accountsPayload?.data) ? accountsPayload.data : [];
  const smokePages = [];
  if (pages[0]) smokePages.push(pages[0]);
  const igLinkedPage = pages.find((page) => page.instagram_business_account?.id);
  if (igLinkedPage && !smokePages.some((page) => page.id === igLinkedPage.id)) {
    smokePages.push(igLinkedPage);
  }
  const smoke = [];
  for (const page of smokePages) {
    smoke.push(await testConversations({ graphVersion, appSecret, page }));
  }

  if (args.writeEnv) {
    writeEnvValue(args.envFile, 'META_ACCESS_TOKEN', runtimeToken);
  }

  console.log('');
  console.log(
    JSON.stringify(
      {
        shortLivedExpiresIn: codeExchange.expires_in || null,
        longLivedExpiresIn: exchangedExpiresIn,
        tokenType: debugPayload?.data?.type || '(unknown)',
        isValid: Boolean(debugPayload?.data?.is_valid),
        grantedScopes: oauthResult.grantedScopes,
        effectiveScopes: scopes,
        missingDmScopes: REQUIRED_DM_SCOPES.filter((scope) => !scopes.includes(scope)),
        pagesVisible: pages.length,
        smoke,
        wroteEnv: args.writeEnv,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

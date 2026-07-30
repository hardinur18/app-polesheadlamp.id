import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REQUIRED_DM_SCOPES = [
  'pages_messaging',
  'instagram_manage_messages',
  'pages_manage_metadata',
  'pages_show_list',
];

function parseArgs(argv) {
  const args = {
    envFile: path.resolve(process.cwd(), 'supabase/functions/.env.local'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--env-file') {
      args.envFile = path.resolve(process.cwd(), argv[index + 1] || '');
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

async function fetchMetaJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Meta request gagal (${response.status})`);
  }
  return payload;
}

function createAppSecretProof(appSecret, accessToken) {
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

async function debugToken({ appId, appSecret, accessToken }) {
  const url = new URL('https://graph.facebook.com/debug_token');
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', `${appId}|${appSecret}`);
  return fetchMetaJson(url.toString());
}

async function fetchAccounts({ version, appSecret, accessToken }) {
  const url = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  url.searchParams.set(
    'fields',
    'id,name,access_token,tasks,instagram_business_account{id,username,name}',
  );
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('appsecret_proof', createAppSecretProof(appSecret, accessToken));
  return fetchMetaJson(url.toString());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const values = readEnvFile(args.envFile);
  const appId = requireValue(values, 'META_APP_ID');
  const appSecret = requireValue(values, 'META_APP_SECRET');
  const accessToken = values.META_DM_USER_TOKEN?.trim() || requireValue(values, 'META_ACCESS_TOKEN');
  const version = values.META_GRAPH_VERSION?.trim() || 'v25.0';

  const [debugPayload, accountsPayload] = await Promise.all([
    debugToken({ appId, appSecret, accessToken }),
    fetchAccounts({ version, appSecret, accessToken }),
  ]);

  const scopes = Array.isArray(debugPayload?.data?.scopes) ? debugPayload.data.scopes : [];
  const rows = Array.isArray(accountsPayload?.data) ? accountsPayload.data : [];

  console.log('Token type:', debugPayload?.data?.type || '(unknown)');
  console.log('Missing DM scopes:', REQUIRED_DM_SCOPES.filter((scope) => !scopes.includes(scope)));
  console.log('');
  console.log(
    JSON.stringify(
      rows.map((item) => ({
        pageId: item.id,
        pageName: item.name,
        supportsMessaging: Array.isArray(item.tasks) ? item.tasks.includes('MESSAGING') : false,
        instagramAccountId: item.instagram_business_account?.id || null,
        instagramUsername: item.instagram_business_account?.username || null,
        instagramName: item.instagram_business_account?.name || null,
      })),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

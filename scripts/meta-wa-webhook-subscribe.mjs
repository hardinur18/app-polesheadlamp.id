import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FIELDS = ['messages'];

function parseArgs(argv) {
  const args = {
    envFile: path.resolve(process.cwd(), 'supabase/functions/.env.local'),
    projectEnvFile: path.resolve(process.cwd(), '.env.supabase.local'),
    callbackUrl: '',
    verifyToken: '',
    fields: DEFAULT_FIELDS,
    mode: 'ensure',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--env-file') {
      args.envFile = path.resolve(process.cwd(), argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--project-env-file') {
      args.projectEnvFile = path.resolve(process.cwd(), argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--callback-url') {
      args.callbackUrl = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (value === '--verify-token') {
      args.verifyToken = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (value === '--fields') {
      args.fields = (argv[index + 1] || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (value === '--list') {
      args.mode = 'list';
    }
  }

  return args;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
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
    throw new Error(`${key} belum diatur.`);
  }
  return value;
}

async function fetchMetaJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Meta request gagal (${response.status})`);
  }
  return payload;
}

async function listSubscriptions({ graphVersion, appId, appSecret }) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${appId}/subscriptions`);
  url.searchParams.set('access_token', `${appId}|${appSecret}`);
  return fetchMetaJson(url.toString());
}

async function ensureSubscription({
  graphVersion,
  appId,
  appSecret,
  callbackUrl,
  verifyToken,
  fields,
}) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${appId}/subscriptions`);
  const body = new URLSearchParams({
    object: 'whatsapp_business_account',
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: fields.join(','),
    access_token: `${appId}|${appSecret}`,
  });

  return fetchMetaJson(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envValues = readEnvFile(args.envFile);
  const projectEnvValues = readEnvFile(args.projectEnvFile);

  const appId = requireValue(envValues, 'META_APP_ID');
  const appSecret = requireValue(envValues, 'META_APP_SECRET');
  const graphVersion = envValues.META_GRAPH_VERSION?.trim() || 'v25.0';
  const callbackUrl = args.callbackUrl || projectEnvValues.VITE_FUNCTIONS_BASE_URL?.trim()?.replace(
    /\/make-server-f781cd00$/,
    '/meta-messaging-webhook',
  ) || projectEnvValues.META_MESSAGING_CALLBACK_URL?.trim();
  const verifyToken =
    args.verifyToken ||
    projectEnvValues.META_MESSAGING_VERIFY_TOKEN?.trim() ||
    envValues.META_MESSAGING_VERIFY_TOKEN?.trim();

  if (args.mode === 'list') {
    const payload = await listSubscriptions({ graphVersion, appId, appSecret });
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!verifyToken) {
    throw new Error('META_MESSAGING_VERIFY_TOKEN belum ditemukan di env.');
  }

  if (!callbackUrl) {
    throw new Error('Callback URL belum diatur. Isi --callback-url, VITE_FUNCTIONS_BASE_URL, atau META_MESSAGING_CALLBACK_URL.');
  }

  const result = await ensureSubscription({
    graphVersion,
    appId,
    appSecret,
    callbackUrl,
    verifyToken,
    fields: args.fields.length ? args.fields : DEFAULT_FIELDS,
  });
  const subscriptions = await listSubscriptions({ graphVersion, appId, appSecret });

  console.log(
    JSON.stringify(
      {
        ensured: result,
        callbackUrl,
        fields: args.fields.length ? args.fields : DEFAULT_FIELDS,
        subscriptions: subscriptions.data || [],
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

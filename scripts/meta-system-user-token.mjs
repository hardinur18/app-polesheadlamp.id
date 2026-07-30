import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_SCOPES = ['ads_management', 'ads_read', 'business_management'];
const DEFAULT_BUSINESS_ID = '329276652382022';

function parseArgs(argv) {
  const args = {
    writeEnv: false,
    envFile: path.resolve(process.cwd(), 'supabase/functions/.env.local'),
    businessId: process.env.META_BUSINESS_ID || DEFAULT_BUSINESS_ID,
    systemUserId: process.env.META_SYSTEM_USER_ID || '',
    systemUserName: process.env.META_SYSTEM_USER_NAME || '',
    scopes: process.env.META_SYSTEM_USER_SCOPES
      ? process.env.META_SYSTEM_USER_SCOPES.split(',').map((value) => value.trim()).filter(Boolean)
      : DEFAULT_SCOPES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--write-env') {
      args.writeEnv = true;
      continue;
    }
    if (value === '--env-file') {
      args.envFile = path.resolve(process.cwd(), argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--business-id') {
      args.businessId = argv[index + 1] || args.businessId;
      index += 1;
      continue;
    }
    if (value === '--system-user-id') {
      args.systemUserId = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (value === '--system-user-name') {
      args.systemUserName = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (value === '--scopes') {
      args.scopes = (argv[index + 1] || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return args;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    values[key] = rest.join('=').trim();
  }

  return { raw, values };
}

function updateEnvValue(raw, key, nextValue) {
  const lines = raw.split(/\r?\n/);
  let updated = false;
  const nextLines = lines.map((line) => {
    if (!line.startsWith(`${key}=`)) return line;
    updated = true;
    return `${key}=${nextValue}`;
  });

  if (!updated) {
    nextLines.push(`${key}=${nextValue}`);
  }

  return `${nextLines.join('\n').replace(/\n*$/, '\n')}`;
}

function requireValue(values, key) {
  const value = values[key]?.trim();
  if (!value) {
    throw new Error(`${key} belum diatur di env file.`);
  }
  return value;
}

function maskToken(token) {
  if (!token) return '(kosong)';
  if (token.length <= 18) return `${token.slice(0, 4)}...${token.slice(-2)}`;
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function createAppSecretProof(appSecret, accessToken) {
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

async function fetchMetaJson({ method = 'GET', version, pathName, query = {}, form = null }) {
  const url = new URL(`https://graph.facebook.com/${version}${pathName}`);
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, value);
  }

  const init = { method, headers: {} };
  if (form) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(form).toString();
  }

  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || `Meta request gagal (${response.status})`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function listEdge({ version, edge, fields, accessToken, appSecret, businessId }) {
  return fetchMetaJson({
    version,
    pathName: `/${businessId}/${edge}`,
    query: {
      fields,
      access_token: accessToken,
      appsecret_proof: createAppSecretProof(appSecret, accessToken),
    },
  });
}

async function debugToken({ version, appId, appSecret, inputToken }) {
  return fetchMetaJson({
    version,
    pathName: '/debug_token',
    query: {
      input_token: inputToken,
      access_token: `${appId}|${appSecret}`,
    },
  });
}

function resolveSystemUser({ systemUsers, systemUserId, systemUserName }) {
  if (systemUserId) {
    const matched = systemUsers.find((item) => item.id === systemUserId);
    if (!matched) {
      throw new Error(`System user ${systemUserId} tidak ditemukan di business ini.`);
    }
    return matched;
  }

  if (systemUserName) {
    const lowered = systemUserName.toLowerCase();
    const matched = systemUsers.find((item) => (item.name || '').toLowerCase() === lowered);
    if (!matched) {
      throw new Error(`System user bernama "${systemUserName}" tidak ditemukan di business ini.`);
    }
    return matched;
  }

  if (systemUsers.length === 1) {
    return systemUsers[0];
  }

  const preferred = systemUsers.find((item) =>
    (item.name || '').toLowerCase().includes('conversion'),
  );
  if (preferred) return preferred;

  throw new Error(
    'System user lebih dari satu. Jalankan lagi dengan --system-user-id atau --system-user-name.',
  );
}

function summarizeAdmins(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name || '(tanpa nama)',
    email: entry.email || '(tanpa email)',
    role: entry.role || '(tanpa role)',
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { raw, values } = readEnvFile(args.envFile);

  const appId = requireValue(values, 'META_APP_ID');
  const appSecret = requireValue(values, 'META_APP_SECRET');
  const adminAccessToken = requireValue(values, 'META_ACCESS_TOKEN');
  const version = values.META_GRAPH_VERSION?.trim() || 'v25.0';
  const scopes = args.scopes.length > 0 ? args.scopes : DEFAULT_SCOPES;

  console.log(`Meta business: ${args.businessId}`);
  console.log(`Graph version: ${version}`);
  console.log(`Scopes target: ${scopes.join(', ')}`);

  const [businessUsersPayload, pendingUsersPayload, systemUsersPayload] = await Promise.all([
    listEdge({
      version,
      edge: 'business_users',
      fields: 'id,name,role,email',
      accessToken: adminAccessToken,
      appSecret,
      businessId: args.businessId,
    }),
    listEdge({
      version,
      edge: 'pending_users',
      fields: 'id,name,role,email',
      accessToken: adminAccessToken,
      appSecret,
      businessId: args.businessId,
    }),
    listEdge({
      version,
      edge: 'system_users',
      fields: 'id,name,role',
      accessToken: adminAccessToken,
      appSecret,
      businessId: args.businessId,
    }),
  ]);

  const businessUsers = Array.isArray(businessUsersPayload.data) ? businessUsersPayload.data : [];
  const pendingUsers = Array.isArray(pendingUsersPayload.data) ? pendingUsersPayload.data : [];
  const systemUsers = Array.isArray(systemUsersPayload.data) ? systemUsersPayload.data : [];
  const activeAdmins = businessUsers.filter((entry) => entry.role === 'ADMIN');
  const pendingAdmins = pendingUsers.filter((entry) => entry.role === 'ADMIN');
  const systemUser = resolveSystemUser({
    systemUsers,
    systemUserId: args.systemUserId,
    systemUserName: args.systemUserName,
  });

  console.log('\nAdmin aktif:');
  console.log(JSON.stringify(summarizeAdmins(activeAdmins), null, 2));

  if (pendingAdmins.length > 0) {
    console.log('\nAdmin pending:');
    console.log(JSON.stringify(summarizeAdmins(pendingAdmins), null, 2));
  }

  console.log('\nSystem user terpilih:');
  console.log(JSON.stringify(systemUser, null, 2));

  if (activeAdmins.length < 2) {
    throw new Error(
      `Business ini baru punya ${activeAdmins.length} admin aktif. Meta biasanya butuh minimal 2 admin aktif sebelum system user token bisa dibuat.`,
    );
  }

  const tokenPayload = await fetchMetaJson({
    method: 'POST',
    version,
    pathName: `/${systemUser.id}/access_tokens`,
    form: {
      business_app: appId,
      scope: scopes.join(','),
      access_token: adminAccessToken,
      appsecret_proof: createAppSecretProof(appSecret, adminAccessToken),
    },
  });

  const systemUserAccessToken = tokenPayload.access_token?.trim();
  if (!systemUserAccessToken) {
    throw new Error('Meta tidak mengembalikan access_token untuk system user.');
  }

  const debugPayload = await debugToken({
    version,
    appId,
    appSecret,
    inputToken: systemUserAccessToken,
  });

  const tokenData = debugPayload.data || {};
  console.log('\nSystem user token berhasil dibuat:');
  console.log(
    JSON.stringify(
      {
        accessTokenMasked: maskToken(systemUserAccessToken),
        type: tokenData.type || null,
        application: tokenData.application || null,
        isValid: Boolean(tokenData.is_valid),
        scopes: Array.isArray(tokenData.scopes) ? tokenData.scopes : [],
        granularScopes: Array.isArray(tokenData.granular_scopes) ? tokenData.granular_scopes : [],
      },
      null,
      2,
    ),
  );

  if (args.writeEnv) {
    const nextRaw = updateEnvValue(raw, 'META_ACCESS_TOKEN', systemUserAccessToken);
    fs.writeFileSync(args.envFile, nextRaw, 'utf8');
    console.log(`\nMETA_ACCESS_TOKEN berhasil diperbarui di ${args.envFile}`);
  } else {
    console.log('\nEnv file belum diubah. Jalankan lagi dengan --write-env untuk menyimpan token baru.');
  }
}

main().catch((error) => {
  const payload = error?.payload?.error;
  if (payload) {
    console.error('\nMeta error:');
    console.error(
      JSON.stringify(
        {
          message: payload.message || null,
          code: payload.code || null,
          error_subcode: payload.error_subcode || null,
          error_user_title: payload.error_user_title || null,
          error_user_msg: payload.error_user_msg || null,
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`\nError: ${error.message}`);
  }
  process.exit(1);
});

import http from 'node:http';
import { spawnSync } from 'node:child_process';

const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const DEFAULT_PORT = 53682;

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [rawKey, ...rest] = item.slice(2).split('=');
    parsed[rawKey] = rest.length > 0 ? rest.join('=') : 'true';
  }
  return parsed;
}

function requireValue(value, label) {
  if (value && String(value).trim()) return String(value).trim();
  throw new Error(`${label} wajib diisi lewat env atau argumen.`);
}

function formatDuration(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);

  if (days > 0) return `${days} hari ${hours} jam`;
  if (hours > 0) return `${hours} jam`;
  return `${Math.ceil(totalSeconds / 60)} menit`;
}

function openBrowser(url) {
  const platform = process.platform;
  const command =
    platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];

  spawnSync(command[0], command[1], { stdio: 'ignore', shell: false });
}

function waitForAuthCode(port, expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('State OAuth tidak cocok. Tutup tab ini dan ulangi proses.');
        server.close();
        reject(new Error('State OAuth tidak cocok.'));
        return;
      }

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(`Google OAuth error: ${error}`);
        server.close();
        reject(new Error(`Google OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Authorization code tidak ditemukan.');
        server.close();
        reject(new Error('Authorization code tidak ditemukan.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <body style="font-family: sans-serif; padding: 32px;">
            <h2>Google Ads OAuth berhasil</h2>
            <p>Tab ini boleh ditutup. Kembali ke terminal Codex/PowerShell.</p>
          </body>
        </html>
      `);
      server.close();
      resolve(code);
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
}

async function exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.refresh_token) {
    throw new Error(
      [payload.error, payload.error_description]
        .filter(Boolean)
        .join(': ') || 'Google tidak mengembalikan refresh_token.',
    );
  }

  return payload;
}

function updateSupabaseSecret({ refreshToken, projectRef }) {
  const result = spawnSync(
    'npx',
    [
      'supabase',
      'secrets',
      'set',
      `GOOGLE_ADS_REFRESH_TOKEN=${refreshToken}`,
      '--project-ref',
      projectRef,
    ],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );

  if (result.status !== 0) {
    throw new Error('Gagal update Supabase secret. Pastikan sudah login atau SUPABASE_ACCESS_TOKEN tersedia.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || process.env.GOOGLE_OAUTH_PORT || DEFAULT_PORT);
  const clientId = requireValue(args.clientId || process.env.GOOGLE_ADS_CLIENT_ID, 'GOOGLE_ADS_CLIENT_ID');
  const clientSecret = requireValue(
    args.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET,
    'GOOGLE_ADS_CLIENT_SECRET',
  );
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const state = Math.random().toString(36).slice(2);
  const syncSupabase = args['sync-supabase'] === 'true';
  const printToken = args['print-token'] === 'true';
  const projectRef =
    syncSupabase || printToken
      ? requireValue(args['project-ref'] || process.env.SUPABASE_PROJECT_REF, 'SUPABASE_PROJECT_REF')
      : '';

  const authUrl = new URL(GOOGLE_OAUTH_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_ADS_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  console.log(`Redirect URI: ${redirectUri}`);
  console.log('Browser akan dibuka untuk login Google Ads...');

  const codePromise = waitForAuthCode(port, state);
  openBrowser(authUrl.toString());

  console.log('Jika browser tidak terbuka, buka URL ini manual:');
  console.log(authUrl.toString());

  const code = await codePromise;
  const tokenPayload = await exchangeCodeForToken({ clientId, clientSecret, redirectUri, code });
  const refreshToken = tokenPayload.refresh_token;
  const refreshTokenExpiresIn = formatDuration(tokenPayload.refresh_token_expires_in);

  console.log('\nRefresh token baru berhasil dibuat.');
  console.log('Simpan sebagai Supabase secret GOOGLE_ADS_REFRESH_TOKEN.');
  if (refreshTokenExpiresIn) {
    console.warn(
      `PERINGATAN: Google memberi refresh_token_expires_in sekitar ${refreshTokenExpiresIn}. ` +
        'Ini biasanya berarti akses masih time-based/OAuth app belum benar-benar production.',
    );
  }
  console.warn(
    'Pastikan OAuth consent screen Google Cloud sudah In production, bukan Testing. ' +
      'Kalau masih Testing, Google bisa memutus refresh token sekitar 7 hari.',
  );
  console.warn(
    'Jangan generate refresh token baru berulang kalau token-health masih OK; ' +
      'Google punya limit refresh token per user/client dan token lama bisa ikut mati.',
  );

  if (syncSupabase) {
    updateSupabaseSecret({ refreshToken, projectRef });
    console.log('Supabase secret GOOGLE_ADS_REFRESH_TOKEN berhasil diupdate.');
  } else if (printToken) {
    console.log('\nCommand update Supabase:');
    console.log(`npx supabase secrets set GOOGLE_ADS_REFRESH_TOKEN="${refreshToken}" --project-ref ${projectRef}`);
  } else {
    console.log('\nToken tidak ditampilkan agar tidak bocor ke log terminal.');
    console.log('Rekomendasi: jalankan ulang dengan --sync-supabase=true agar secret langsung dipasang.');
    console.log('Kalau benar-benar perlu command manual, tambahkan --print-token=true.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

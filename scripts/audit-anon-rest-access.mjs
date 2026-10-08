import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(PROJECT_ROOT, 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'anon-rest-access-audit.json');

const LOCAL_ENV = readLocalEnv();

const envValue = (...keys) => {
  for (const key of keys) {
    const value = process.env[key] || LOCAL_ENV[key];
    if (value) return value;
  }
  return '';
};

const SUPABASE_URL = envValue('SMOKE_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL');
const ANON_KEY = envValue('SMOKE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const REQUEST_TIMEOUT_MS = Number(envValue('ANON_REST_AUDIT_TIMEOUT_MS')) || 15000;

const INTERNAL_TABLES = [
  'profiles',
  'branches',
  'services',
  'vehicle_types',
  'leads',
  'orders',
  'prospect_bookings',
  'technician_schedules',
  'technician_daily_reports',
  'daily_ads',
  'daily_ads_duplicate_archive',
  'daily_ads_sync_runs',
  'lead_spam_daily_inputs',
  'payment_methods',
  'finance_categories',
  'finance_accounts',
  'recurring_expenses',
  'recurring_expense_payments',
  'operational_expense_categories',
  'operational_expenses',
  'operational_expense_ledger',
  'manual_debts',
  'ad_platforms',
  'ad_sub_channels',
  'ad_sources',
  'ad_accounts',
  'ad_account_assignments',
  'ad_account_owner_assignments',
  'ad_api_accounts',
  'ad_account_api_mappings',
  'proof_assets',
  'crm_contacts',
  'crm_contact_links',
  'whatsapp_conversations',
  'whatsapp_messages',
  'whatsapp_contacts',
  'audit_logs',
  'vendors',
  'roles',
  'role_permissions',
  'permissions',
  'user_custom_permissions',
  'affiliates',
  'cancel_reasons',
  'wa_templates',
  'products',
  'stock_units',
  'stock_transactions',
  'notifications',
  'kv_store_f781cd00',
  'payroll_runs',
  'payroll_run_items',
  'payroll_deductions',
  'salary_profiles',
  'kpi_library',
  'employee_kpi_assignments',
  'cs_okr_targets',
  'ads_live_daily_snapshots',
  'owner_profitability_daily_recaps',
  'owner_profitability_daily_details',
  'payment_transactions',
  'embed_lead_form_submissions',
];

const PUBLIC_ALLOWED_TABLES = [
  'embed_lead_forms',
  'embed_lead_form_fields',
  'embed_lead_form_cs_routes',
];

function readLocalEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local');
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

async function probeTable(table) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    const exposedRows = Array.isArray(payload) ? payload.length : null;
    return {
      table,
      status: response.status,
      ms: Date.now() - startedAt,
      exposedRows,
      denied: [401, 403, 404].includes(response.status),
    };
  } catch (error) {
    return {
      table,
      status: 'request_failed',
      ms: Date.now() - startedAt,
      exposedRows: null,
      denied: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  ensureArtifactDir();

  if (!SUPABASE_URL || !ANON_KEY) {
    const payload = {
      generatedAt: new Date().toISOString(),
      skipped: true,
      passed: true,
      nextAction: 'Set SMOKE_SUPABASE_URL/SUPABASE_URL dan SMOKE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY untuk audit anon REST.',
    };
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const internal = [];
  for (const table of INTERNAL_TABLES) {
    internal.push(await probeTable(table));
  }

  const publicAllowed = [];
  for (const table of PUBLIC_ALLOWED_TABLES) {
    publicAllowed.push(await probeTable(table));
  }

  const normalizedInternal = internal.map((row) => ({
    ...row,
    passed: row.denied,
  }));
  const leakingTables = normalizedInternal.filter((row) => !row.passed);
  const payload = {
    generatedAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    passed: leakingTables.length === 0,
    internal: normalizedInternal,
    publicAllowed,
    leakingTables: leakingTables.map(({ table, status, exposedRows }) => ({ table, status, exposedRows })),
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));

  if (!payload.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const payload = {
    generatedAt: new Date().toISOString(),
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  };
  ensureArtifactDir();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
});

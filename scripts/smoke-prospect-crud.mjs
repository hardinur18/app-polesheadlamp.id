import fs from 'node:fs';
import path from 'node:path';

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
const SERVICE_ROLE_KEY = envValue('SMOKE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
const FUNCTIONS_BASE =
  envValue('SMOKE_FUNCTIONS_BASE_URL', 'VITE_FUNCTIONS_BASE_URL') ||
  `${SUPABASE_URL}/functions/v1/make-server-f781cd00`;
const BASE_URL = envValue('SMOKE_BASE_URL') || 'http://localhost:5174';
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'prospect-crud-smoke.json');
const ROLE_ACCOUNTS = envValue('SMOKE_ROLE_ACCOUNTS')
  ? JSON.parse(envValue('SMOKE_ROLE_ACCOUNTS'))
  : {};
const PROSPECT_ACCOUNT = envValue('SMOKE_PROSPECT_ACCOUNT')
  ? JSON.parse(envValue('SMOKE_PROSPECT_ACCOUNT'))
  : null;
const OWNER_EMAIL =
  envValue('SMOKE_OWNER_EMAIL', 'PHASE1_OWNER_EMAIL') ||
  ROLE_ACCOUNTS?.Owner?.email ||
  'hardinurahman@gmail.com';
const OWNER_PASSWORD =
  envValue('SMOKE_OWNER_PASSWORD', 'PHASE1_OWNER_PASSWORD') ||
  ROLE_ACCOUNTS?.Owner?.password ||
  '';
const CS_PASSWORD = `ProspectSmoke!${Date.now()}Aa`;

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

async function jsonFetch(url, options = {}) {
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

function serviceRoleHeaders(json = false) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function serviceRoleFetch(url, options = {}) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY/SMOKE_SUPABASE_SERVICE_ROLE_KEY belum tersedia.');
  }
  return jsonFetch(url, options);
}

async function signIn(email, password) {
  return jsonFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
}

async function createTemporaryCs(ownerToken) {
  const email = `prospect.cs.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const payload = await jsonFetch(`${FUNCTIONS_BASE}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: CS_PASSWORD,
      name: 'Prospect CRUD Smoke CS',
      role: 'CS',
      branchId: 'b1',
      employmentStatus: 'permanent',
    }),
  });

  return {
    id: payload?.user?.id,
    email,
    password: CS_PASSWORD,
    role: 'CS',
    temporary: true,
  };
}

async function createTemporaryCsViaServiceRole() {
  const email = `prospect.cs.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const payload = await serviceRoleFetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceRoleHeaders(true),
    body: JSON.stringify({
      email,
      password: CS_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: 'Prospect CRUD Smoke CS',
        role: 'CS',
      },
    }),
  });

  const user = payload?.user || payload;
  if (!user?.id) {
    throw new Error('Service-role CS creation returned no id.');
  }

  await serviceRoleFetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...serviceRoleHeaders(true),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: user.id,
      email,
      name: 'Prospect CRUD Smoke CS',
      role: 'CS',
      status: 'active',
      branch_id: null,
      employment_status: 'permanent',
    }),
  });

  return {
    id: user.id,
    email,
    password: CS_PASSWORD,
    role: 'CS',
    temporary: true,
    createdBy: 'service-role',
  };
}

async function deleteTemporaryUser(ownerToken, user) {
  if (!user?.id) return { deleted: false, error: 'missing user id' };

  try {
    await jsonFetch(`${FUNCTIONS_BASE}/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    return { deleted: true, id: user.id, email: user.email };
  } catch (error) {
    return {
      deleted: false,
      id: user.id,
      email: user.email,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function deleteTemporaryUserViaServiceRole(user) {
  if (!user?.id) return { deleted: false, error: 'missing user id' };

  try {
    try {
      await serviceRoleFetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: serviceRoleHeaders(),
      });
    } catch {
      // Auth deletion below is enough if profile cleanup already cascaded.
    }

    await serviceRoleFetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: serviceRoleHeaders(),
    });
    return { deleted: true, id: user.id, email: user.email };
  } catch (error) {
    return {
      deleted: false,
      id: user.id,
      email: user.email,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function appDataHeaders(token, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function createLead(token, payload) {
  const body = await jsonFetch(`${FUNCTIONS_BASE}/app-data/leads`, {
    method: 'POST',
    headers: appDataHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return body?.row;
}

async function updateLead(token, id, payload) {
  const body = await jsonFetch(`${FUNCTIONS_BASE}/app-data/leads/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: appDataHeaders(token, true),
    body: JSON.stringify(payload),
  });
  return body?.row;
}

async function deleteLead(token, id) {
  await jsonFetch(`${FUNCTIONS_BASE}/app-data/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: appDataHeaders(token),
  });
}

async function deleteLeadViaServiceRole(id) {
  await serviceRoleFetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: serviceRoleHeaders(),
  });
}

async function expectFailure(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error('Expected request to fail, but it succeeded.');
}

async function main() {
  ensureArtifactDir();

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    functionsBase: FUNCTIONS_BASE,
    passed: false,
    skipped: false,
    steps: [],
    cleanup: [],
  };

  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('SMOKE_SUPABASE_URL/SUPABASE_URL dan SMOKE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY wajib diisi.');
  }

  let ownerToken = null;
  let csAccount = PROSPECT_ACCOUNT || ROLE_ACCOUNTS?.CS || null;
  let createdCs = null;
  const canUseServiceRoleAdmin = Boolean(SERVICE_ROLE_KEY);
  const createdLeadIds = [];
  const runId = Date.now().toString(36).toUpperCase();
  const leadId = `SMK${runId.slice(-7)}`;
  const samePhoneLeadId = `SMP${runId.slice(-7)}`;
  const duplicateLeadId = `SMD${runId.slice(-7)}`;

  try {
    if (OWNER_PASSWORD) {
      result.steps.push({ step: 'owner-sign-in', passed: false });
      const ownerAuth = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
      ownerToken = ownerAuth.access_token;
      result.steps[result.steps.length - 1].passed = true;
    }

    if (!csAccount && ownerToken) {
      result.steps.push({ step: 'create-temporary-cs', passed: false });
      createdCs = await createTemporaryCs(ownerToken);
      csAccount = createdCs;
      result.steps[result.steps.length - 1].passed = Boolean(createdCs?.id);
    } else if (!csAccount && canUseServiceRoleAdmin) {
      result.steps.push({ step: 'create-temporary-cs-service-role', passed: false });
      createdCs = await createTemporaryCsViaServiceRole();
      csAccount = createdCs;
      result.steps[result.steps.length - 1].passed = Boolean(createdCs?.id);
    }

    if (!csAccount?.email || !csAccount?.password) {
      result.skipped = true;
      result.passed = true;
      result.nextAction = 'Set SMOKE_OWNER_PASSWORD/PHASE1_OWNER_PASSWORD, SMOKE_SUPABASE_SERVICE_ROLE_KEY, SMOKE_PROSPECT_ACCOUNT, atau SMOKE_ROLE_ACCOUNTS.CS untuk menjalankan Prospek CRUD smoke.';
      return;
    }

    if (!ownerToken && !canUseServiceRoleAdmin) {
      result.skipped = true;
      result.passed = true;
      result.nextAction = 'Prospek CRUD smoke butuh Owner credential atau SUPABASE_SERVICE_ROLE_KEY untuk cleanup aman.';
      return;
    }

    result.steps.push({ step: 'cs-sign-in', passed: false });
    const csAuth = await signIn(csAccount.email, csAccount.password);
    const csToken = csAuth.access_token;
    result.steps[result.steps.length - 1].passed = true;

    const basePayload = {
      id: leadId,
      name: `Smoke Prospek ${runId}`,
      phone: `0813${String(Date.now()).slice(-8)}`,
      status: 'Pending',
      notes: `Smoke create ${runId}`,
      cs_id: csAccount.id || null,
      last_contact: 'Baru saja',
      template_history: [],
      social_platform: 'instagram',
      social_username: `smokeprospek${runId.toLowerCase()}`,
      social_profile_url: `https://instagram.com/smokeprospek${runId.toLowerCase()}`,
      social_chat_url: `https://instagram.com/direct/t/smokeprospek${runId.toLowerCase()}`,
      origin: 'manual',
      landing_page_url: `https://polesheadlamp-id.pages.dev/leads?smoke=${runId}`,
      utm_source: 'smoke',
      utm_campaign: runId,
    };

    result.steps.push({ step: 'create-prospect', passed: false, id: leadId });
    const created = await createLead(csToken, basePayload);
    createdLeadIds.push(leadId);
    result.steps[result.steps.length - 1].passed = created?.id === leadId;

    result.steps.push({ step: 'reject-exact-active-duplicate', passed: false, id: duplicateLeadId });
    const duplicateError = await expectFailure(() =>
      createLead(csToken, {
        ...basePayload,
        id: duplicateLeadId,
        notes: `Smoke exact duplicate ${runId}`,
      }),
    );
    result.steps[result.steps.length - 1].passed =
      /nomor dan nama yang sama|prospek tidak double|duplicate|409|23505/i.test(
        duplicateError instanceof Error ? duplicateError.message : String(duplicateError),
      );

    result.steps.push({ step: 'same-phone-different-name-allowed', passed: false, id: samePhoneLeadId });
    const samePhoneDifferentName = await createLead(csToken, {
      ...basePayload,
      id: samePhoneLeadId,
      name: `Smoke Prospek Nama Beda ${runId}`,
      notes: `Smoke same phone different name ${runId}`,
    });
    createdLeadIds.push(samePhoneLeadId);
    result.steps[result.steps.length - 1].passed = samePhoneDifferentName?.id === samePhoneLeadId;

    result.steps.push({ step: 'update-prospect', passed: false, id: leadId });
    const updated = await updateLead(csToken, leadId, {
      ...basePayload,
      status: 'Follow Up',
      notes: `Smoke update ${runId}`,
    });
    result.steps[result.steps.length - 1].passed = updated?.status === 'Follow Up';

    result.steps.push({ step: 'delete-prospect-cleanup', passed: false, ids: [...createdLeadIds] });
    for (const id of [...createdLeadIds].reverse()) {
      if (ownerToken) {
        await deleteLead(ownerToken, id);
      } else {
        await deleteLeadViaServiceRole(id);
      }
      createdLeadIds.splice(createdLeadIds.indexOf(id), 1);
    }
    result.steps[result.steps.length - 1].passed = true;

    result.passed = result.steps.every((step) => step.passed);
  } finally {
    if ((ownerToken || canUseServiceRoleAdmin) && createdLeadIds.length > 0) {
      for (const id of [...createdLeadIds].reverse()) {
        try {
          if (ownerToken) {
            await deleteLead(ownerToken, id);
          } else {
            await deleteLeadViaServiceRole(id);
          }
          result.cleanup.push({ type: 'lead', deleted: true, id });
        } catch (error) {
          result.cleanup.push({
            type: 'lead',
            deleted: false,
            id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (createdCs) {
      result.cleanup.push(
        ownerToken
          ? await deleteTemporaryUser(ownerToken, createdCs)
          : await deleteTemporaryUserViaServiceRole(createdCs),
      );
    }
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  }

  if (!result.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  ensureArtifactDir();
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});

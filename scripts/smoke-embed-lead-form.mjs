import fs from 'node:fs';
import path from 'node:path';

import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const CHROME_PATH =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SUPABASE_URL =
  process.env.SMOKE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SMOKE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/make-server-f781cd00`;
const ARTIFACT_DIR = path.join(process.cwd(), 'File Review', 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'embed-lead-form-smoke.json');

const runId = `smoke-${Date.now().toString(36)}`;
const formId = `embed-${runId}`;
const slug = `embed-${runId}`;
const publicToken = `token${Date.now().toString(36)}`;
const customerName = `Smoke Embed ${runId}`;
const customerPhone = `0899${String(Date.now()).slice(-8)}`;

const edgeHeaders = (json = false) => ({
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const restHeaders = (json = false) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return body;
}

async function saveMaster(type, item) {
  return fetchJson(`${FUNCTION_BASE}/master/${type}`, {
    method: 'POST',
    headers: edgeHeaders(true),
    body: JSON.stringify(item),
  });
}

async function deleteMaster(type, id) {
  const response = await fetch(`${FUNCTION_BASE}/master/${type}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: edgeHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete ${type}/${id}: ${response.status} ${await response.text()}`);
  }
}

async function listMaster(type) {
  return fetchJson(`${FUNCTION_BASE}/master/${type}`, {
    headers: edgeHeaders(),
  });
}

async function deleteLead(id) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...restHeaders(),
      Prefer: 'return=representation',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete smoke lead ${id}: ${response.status} ${await response.text()}`);
  }
}

function createSmokeFormRecord() {
  const now = new Date().toISOString();
  return {
    id: formId,
    name: 'Smoke Embed Form',
    slug,
    publicToken,
    description: 'Smoke test form, safe to delete.',
    status: 'active',
    embedMode: 'both',
    defaultStatus: 'Pending',
    defaultServiceId: null,
    defaultServiceName: null,
    platformId: null,
    subChannelId: null,
    advertiserId: null,
    adAccountId: null,
    fallbackCsId: null,
    routingMode: 'single_cs',
    roundRobinCursor: 0,
    lastRoutedCsId: null,
    lastRoutedAt: null,
    thankYouMessage: 'Smoke diterima.',
    redirectUrl: null,
    submitButtonLabel: 'Kirim',
    metaPixelId: null,
    metaEventName: 'Lead',
    tiktokPixelId: null,
    tiktokEventName: 'SubmitForm',
    googleTagId: null,
    googleAdsConversionId: null,
    googleAdsConversionLabel: null,
    googleEventName: 'conversion',
    trackingConfig: {},
    themeConfig: {},
    spamProtectionConfig: {},
    allowedEmbedOrigins: [],
    metadata: { smoke: true, runId },
    createdBy: 'smoke',
    updatedBy: 'smoke',
    createdAt: now,
    updatedAt: now,
    fields: [
      {
        fieldKey: 'name',
        label: 'Nama Customer',
        placeholder: 'Nama lengkap',
        inputType: 'text',
        isVisible: true,
        isRequired: true,
        sortOrder: 10,
        options: [],
        validationConfig: {},
        metadata: {},
      },
      {
        fieldKey: 'phone',
        label: 'No. WhatsApp',
        placeholder: '08xxxxxxxxxx',
        inputType: 'tel',
        isVisible: true,
        isRequired: true,
        sortOrder: 20,
        options: [],
        validationConfig: {},
        metadata: {},
      },
      {
        fieldKey: 'notes',
        label: 'Catatan',
        placeholder: 'Catatan smoke',
        inputType: 'textarea',
        isVisible: true,
        isRequired: false,
        sortOrder: 30,
        options: [],
        validationConfig: {},
        metadata: {},
      },
    ],
    routes: [],
  };
}

async function cleanup(createdLeadIds = []) {
  const errors = [];

  for (const leadId of createdLeadIds) {
    try {
      await deleteLead(leadId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const submissions = await listMaster('embed_lead_form_submission');
    await Promise.all(
      submissions
        .filter((item) => item.form_slug === slug || item.form_id === formId)
        .map((item) => deleteMaster('embed_lead_form_submission', item.id)),
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    await deleteMaster('embed_lead_form', formId);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return errors;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SMOKE_SUPABASE_URL/SUPABASE_URL dan SMOKE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY wajib diisi.');
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const createdLeadIds = [];
  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    slug,
    customerName,
    passed: false,
    steps: [],
    cleanupErrors: [],
  };

  try {
    await saveMaster('embed_lead_form', createSmokeFormRecord());
    result.steps.push({ step: 'create-fallback-form', passed: true });

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(60_000);
      const url = `${BASE_URL}/embed/form/${slug}?utm_source=smoke&utm_campaign=${runId}`;
      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.waitForFunction(
        () => document.body.innerText.includes('Smoke Embed Form'),
        { timeout: 60_000 },
      );
      result.steps.push({ step: 'load-public-form', passed: true, status: response?.status() ?? null });

      await page.type('input[autocomplete="name"]', customerName);
      await page.type('input[autocomplete="tel"]', customerPhone);
      await page.type('textarea', `Smoke note ${runId}`);
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => document.body.innerText.includes('Data berhasil dikirim'),
        { timeout: 60_000 },
      );
      result.steps.push({ step: 'submit-public-form', passed: true });
    } finally {
      await browser.close();
    }

    const leads = await fetchJson(
      `${SUPABASE_URL}/rest/v1/leads?select=id,name,phone,status,notes&name=eq.${encodeURIComponent(customerName)}`,
      { headers: restHeaders() },
    );
    if (!Array.isArray(leads) || leads.length === 0) {
      throw new Error('Smoke lead was not found after form submit.');
    }

    createdLeadIds.push(...leads.map((lead) => lead.id));
    result.steps.push({ step: 'verify-lead-created', passed: true, leadIds: createdLeadIds });

    const submissions = await listMaster('embed_lead_form_submission');
    const submission = submissions.find((item) => item.form_slug === slug && item.status === 'lead_created');
    if (!submission) {
      throw new Error('Smoke submission log was not found in fallback storage.');
    }
    result.steps.push({ step: 'verify-submission-log', passed: true, submissionId: submission.id });

    result.passed = true;
  } finally {
    result.cleanupErrors = await cleanup(createdLeadIds);
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  }

  if (!result.passed || result.cleanupErrors.length > 0) {
    throw new Error(`Embed smoke failed or cleanup incomplete. See ${OUTPUT_PATH}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

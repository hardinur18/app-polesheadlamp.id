import { supabase } from '@/lib/supabaseClient';
import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';

export const PROOF_ASSETS_BUCKET = 'proof-assets';

const PROOF_ASSET_MASTER_TYPE = 'proof_asset';
const PROOF_ASSET_MASTER_URL = buildMakeServerUrl(`/master/${PROOF_ASSET_MASTER_TYPE}`);
const PROOF_ASSET_UPLOAD_URL = buildMakeServerUrl('/upload-image');
const PROOF_ASSET_LEGACY_UPLOAD_URL = buildMakeServerUrl('/meta/messaging/whatsapp/media-upload');
const PROOF_ASSET_UPLOAD_TARGET_BYTES = 760 * 1024;
const PROOF_ASSET_RETRY_UPLOAD_TARGET_BYTES = 320 * 1024;
const PROOF_ASSET_FINAL_RETRY_UPLOAD_TARGET_BYTES = 80 * 1024;
const PROOF_ASSET_INLINE_FALLBACK_TARGET_BYTES = 60 * 1024;
const PROOF_ASSET_COMPRESS_START_BYTES = 700 * 1024;
const PROOF_ASSET_MAX_IMAGE_DIMENSION = 1500;
const PROOF_ASSET_RETRY_MAX_IMAGE_DIMENSION = 1200;
const PROOF_ASSET_FINAL_RETRY_MAX_IMAGE_DIMENSION = 720;
const PROOF_ASSET_INLINE_FALLBACK_MAX_IMAGE_DIMENSION = 640;

export type ProofAsset = {
  id: string;
  title: string;
  vehicleTypeId: string | null;
  year: number | null;
  imagePath: string;
  tags: string[];
  caption: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  createdBy: string | null;
};

type ProofAssetStorageRecord = {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  vehicleTypeId?: string | null;
  vehicle_type_id?: string | null;
  year?: number | string | null;
  imagePath?: string | null;
  image_path?: string | null;
  tags?: string[] | string | null;
  caption?: string | null;
  isActive?: boolean | null;
  is_active?: boolean | null;
  usageCount?: number | string | null;
  usage_count?: number | string | null;
  createdAt?: string | null;
  created_at?: string | null;
  createdBy?: string | null;
  created_by?: string | null;
  updatedAt?: string | null;
};

export type ProofAssetInput = {
  id?: string;
  title: string;
  vehicleTypeId?: string | null;
  year?: number | null;
  imagePath: string;
  tags: string[];
  caption?: string | null;
  isActive: boolean;
  createdBy?: string | null;
};

const cleanText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || '';

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOptionalYear = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isHttpUrl = (value: string | null | undefined) => /^https?:\/\//i.test(cleanText(value));

function extractGoogleDriveFileId(value: string | null | undefined) {
  const raw = cleanText(value);
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (!/(\.|^)google\.com$/i.test(parsed.hostname) && !/(\.|^)googleusercontent\.com$/i.test(parsed.hostname)) {
      return '';
    }

    const idParam = parsed.searchParams.get('id');
    if (idParam) return idParam;

    const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
    if (filePathMatch?.[1]) return filePathMatch[1];

    const foldersPathMatch = parsed.pathname.match(/\/uc\/([^/]+)/i);
    if (foldersPathMatch?.[1]) return foldersPathMatch[1];
  } catch {
    return '';
  }

  return '';
}

export function isGoogleDriveProofAssetUrl(value: string | null | undefined) {
  return Boolean(extractGoogleDriveFileId(value));
}

export function isValidProofAssetImageUrl(value: string | null | undefined) {
  return isHttpUrl(value);
}

export function normalizeProofAssetImageUrl(value: string | null | undefined) {
  return cleanText(value);
}

const normalizeErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = String((payload as { error?: unknown }).error || '').trim();
    if (message) return message;
  }
  return fallback;
};

async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload, fallback));
  }
  return payload as T;
}

export function normalizeProofAssetTags(value: string | string[]) {
  const values = Array.isArray(value)
    ? value
    : value.split(/[,;\n]/g);

  return Array.from(
    new Set(
      values
        .map((tag) => cleanText(tag).toLowerCase())
        .filter(Boolean)
        .slice(0, 24),
    ),
  );
}

export function createProofAssetId() {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `proof_${randomPart}`;
}

export function getProofAssetPublicUrl(imagePath: string | null | undefined) {
  if (!imagePath) return '';
  const driveFileId = extractGoogleDriveFileId(imagePath);
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1600`;
  }
  if (isHttpUrl(imagePath) || imagePath.startsWith('data:')) return imagePath;
  return supabase.storage.from(PROOF_ASSETS_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

export function getProofAssetImagePathFromUrl(url: string | null | undefined) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${PROOF_ASSETS_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return '';
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return '';
  }
}

function mapProofAssetFromRecord(record: ProofAssetStorageRecord): ProofAsset {
  const createdAt = record.createdAt || record.created_at || record.updatedAt || new Date().toISOString();
  const tags = Array.isArray(record.tags)
    ? record.tags
    : typeof record.tags === 'string'
      ? normalizeProofAssetTags(record.tags)
      : [];

  return {
    id: cleanText(record.id || '') || createProofAssetId(),
    title: cleanText(record.title || record.name || ''),
    vehicleTypeId: cleanText(record.vehicleTypeId || record.vehicle_type_id || '') || null,
    year: parseOptionalYear(record.year),
    imagePath: cleanText(record.imagePath || record.image_path || ''),
    tags,
    caption: cleanText(record.caption || '') || null,
    isActive: typeof record.isActive === 'boolean'
      ? record.isActive
      : typeof record.is_active === 'boolean'
        ? record.is_active
        : true,
    usageCount: Math.max(0, parseNumber(record.usageCount ?? record.usage_count, 0)),
    createdAt,
    createdBy: cleanText(record.createdBy || record.created_by || '') || null,
  };
}

function mapProofAssetToRecord(input: ProofAssetInput, existing?: ProofAsset | null): ProofAssetStorageRecord {
  const now = new Date().toISOString();

  return {
    id: input.id || existing?.id || createProofAssetId(),
    title: cleanText(input.title),
    vehicleTypeId: input.vehicleTypeId || null,
    year: input.year || null,
    imagePath: input.imagePath,
    tags: normalizeProofAssetTags(input.tags),
    caption: cleanText(input.caption) || null,
    isActive: input.isActive,
    usageCount: existing?.usageCount || 0,
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.createdBy || null,
  };
}

async function fetchProofAssetRecords() {
  const response = await fetch(PROOF_ASSET_MASTER_URL, {
    headers: await getSessionBackedEdgeHeaders(),
  });
  return readJsonResponse<ProofAssetStorageRecord[]>(response, 'Gagal memuat Galeri Bukti.');
}

async function saveProofAssetRecord(record: ProofAssetStorageRecord) {
  const response = await fetch(PROOF_ASSET_MASTER_URL, {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify(record),
  });
  return readJsonResponse<ProofAssetStorageRecord>(response, 'Gagal menyimpan aset.');
}

export async function listProofAssets() {
  const records = await fetchProofAssetRecords();
  return records
    .map(mapProofAssetFromRecord)
    .filter((asset) => asset.id && asset.title)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 500);
}

export async function createProofAsset(input: ProofAssetInput) {
  const record = mapProofAssetToRecord(input);
  const savedRecord = await saveProofAssetRecord(record);
  return mapProofAssetFromRecord(savedRecord);
}

export async function updateProofAsset(id: string, input: Omit<ProofAssetInput, 'id' | 'createdBy'>) {
  const existing = (await listProofAssets()).find((asset) => asset.id === id) || null;
  const record = mapProofAssetToRecord({ ...input, id }, existing);
  const savedRecord = await saveProofAssetRecord(record);
  return mapProofAssetFromRecord(savedRecord);
}

export async function deleteProofAsset(id: string) {
  const response = await fetch(`${PROOF_ASSET_MASTER_URL}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await getSessionBackedEdgeHeaders(),
  });
  await readJsonResponse(response, 'Gagal menghapus aset.');
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal mengompres gambar.'));
    }, type, quality);
  });
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gambar tidak bisa dibaca.'));
      img.src = objectUrl;
    });

    return { image, objectUrl };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

type ProofAssetImageCompressionOptions = {
  force?: boolean;
  maxDimension?: number;
  targetBytes?: number;
};

const proofAssetImageQualitySteps = [0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38, 0.32, 0.26];

const buildProofAssetDimensionSteps = (maxDimension: number) => Array.from(
  new Set(
    [
      maxDimension,
      Math.round(maxDimension * 0.86),
      Math.round(maxDimension * 0.72),
      1100,
      960,
      840,
      720,
      640,
      560,
      480,
    ].filter((value) => value <= maxDimension && value >= 360),
  ),
).sort((a, b) => b - a);

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Gagal membaca gambar hasil kompres.'));
    reader.readAsDataURL(file);
  });
}

function isStorageObjectSizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /maximum allowed size|exceeded.*size|object.*size|terlalu besar/i.test(message);
}

function isStorageUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /bucket not found|storage bucket|supabase_service_role_key|storage.*not.*configured/i.test(message);
}

function getErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 0;
}

function createUploadError(message: string, status: number) {
  const error = new Error(message);
  (error as Error & { status?: number }).status = status;
  return error;
}

function shouldFallbackToLegacyUpload(error: unknown) {
  return [404, 405].includes(getErrorStatus(error));
}

async function compressProofAssetImageFile(
  file: File,
  assetId: string,
  options: ProofAssetImageCompressionOptions = {},
) {
  const targetBytes = options.targetBytes || PROOF_ASSET_UPLOAD_TARGET_BYTES;
  const maxDimension = options.maxDimension || PROOF_ASSET_MAX_IMAGE_DIMENSION;
  const shouldCompress =
    options.force ||
    file.size > PROOF_ASSET_COMPRESS_START_BYTES ||
    !['image/jpeg', 'image/jpg'].includes(file.type.toLowerCase());

  if (!shouldCompress && file.size <= targetBytes) {
    return new File([file], `${assetId}.jpg`, { type: file.type || 'image/jpeg' });
  }

  const { image, objectUrl } = await loadImageElement(file);
  try {
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const sourceMaxDimension = Math.max(naturalWidth, naturalHeight);

    for (const dimension of buildProofAssetDimensionSteps(maxDimension)) {
      const scale = Math.min(1, dimension / sourceMaxDimension);
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Browser tidak bisa memproses gambar ini.');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of proofAssetImageQualitySteps) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (blob.size <= targetBytes) {
          return new File([blob], `${assetId}.jpg`, { type: 'image/jpeg' });
        }
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new Error('Gambar masih terlalu besar setelah dikompres. Coba crop sedikit atau pilih gambar lain.');
}

async function postProofAssetUpload(url: string, uploadFile: File) {
  const formData = new FormData();

  formData.append('file', uploadFile);
  formData.append('bucket', PROOF_ASSETS_BUCKET);
  formData.append('type', 'image');

  const response = await fetch(url, {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders(),
    body: formData,
  });
  const responseText = await response.text().catch(() => '');
  const payload = (responseText
    ? (() => {
        try {
          return JSON.parse(responseText);
        } catch {
          return { error: responseText };
        }
      })()
    : {}) as {
    url?: string | null;
    path?: string | null;
    error?: string | null;
    media?: { url?: string | null; path?: string | null };
  };

  if (!response.ok) {
    throw createUploadError(
      normalizeErrorMessage(payload, `Gagal upload gambar aset. (${response.status})`),
      response.status,
    );
  }

  const publicUrl = cleanText(payload.url || payload.media?.url || '');
  if (!publicUrl) {
    throw new Error('Upload gambar berhasil tapi URL gambar tidak ditemukan.');
  }

  return publicUrl;
}

async function uploadCompressedProofAssetImage(uploadFile: File) {
  try {
    return await postProofAssetUpload(PROOF_ASSET_UPLOAD_URL, uploadFile);
  } catch (error) {
    if (!shouldFallbackToLegacyUpload(error)) {
      throw error;
    }

    return postProofAssetUpload(PROOF_ASSET_LEGACY_UPLOAD_URL, uploadFile);
  }
}

async function createInlineProofAssetImage(file: File, assetId: string) {
  const inlineFile = await compressProofAssetImageFile(file, assetId, {
    force: true,
    maxDimension: PROOF_ASSET_INLINE_FALLBACK_MAX_IMAGE_DIMENSION,
    targetBytes: PROOF_ASSET_INLINE_FALLBACK_TARGET_BYTES,
  });
  return fileToDataUrl(inlineFile);
}

export async function uploadProofAssetImage(file: File, assetId: string) {
  const compressionProfiles = [
    {
      force: file.size > PROOF_ASSET_UPLOAD_TARGET_BYTES,
      maxDimension: PROOF_ASSET_MAX_IMAGE_DIMENSION,
      targetBytes: PROOF_ASSET_UPLOAD_TARGET_BYTES,
    },
    {
      force: true,
      maxDimension: PROOF_ASSET_RETRY_MAX_IMAGE_DIMENSION,
      targetBytes: PROOF_ASSET_RETRY_UPLOAD_TARGET_BYTES,
    },
    {
      force: true,
      maxDimension: PROOF_ASSET_FINAL_RETRY_MAX_IMAGE_DIMENSION,
      targetBytes: PROOF_ASSET_FINAL_RETRY_UPLOAD_TARGET_BYTES,
    },
  ];
  let lastSizeError: unknown = null;
  let storageUnavailableError: unknown = null;

  for (const profile of compressionProfiles) {
    const uploadFile = await compressProofAssetImageFile(file, assetId, profile);
    try {
      return await uploadCompressedProofAssetImage(uploadFile);
    } catch (error) {
      if (isStorageObjectSizeError(error)) {
        lastSizeError = error;
        continue;
      }
      if (isStorageUnavailableError(error)) {
        storageUnavailableError = error;
        break;
      }
      throw error;
    }
  }

  const inlineImage = await createInlineProofAssetImage(file, assetId);
  if (inlineImage) return inlineImage;

  const lastError = storageUnavailableError || lastSizeError;
  throw lastError instanceof Error
    ? lastError
    : new Error('Gambar belum bisa disimpan ke storage.');
}

export async function deleteProofAssetImage(imagePath: string | null | undefined) {
  if (!imagePath) return;
  if (/^https?:\/\//i.test(imagePath) || imagePath.startsWith('data:')) return;

  const { error } = await supabase.storage.from(PROOF_ASSETS_BUCKET).remove([imagePath]);
  if (error) throw error;
}

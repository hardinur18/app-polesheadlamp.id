import { supabase } from '@/lib/supabaseClient';

export const BANK_LOGOS_BUCKET = 'bank-logos';

const LOGO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

function getLogoExtension(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/svg+xml') return 'svg';
  return 'jpg';
}

export function validateBankLogoFile(file: File) {
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    return 'Logo wajib berupa PNG, JPG, WebP, atau SVG.';
  }

  if (file.size > 1.5 * 1024 * 1024) {
    return 'Ukuran logo maksimal 1.5 MB.';
  }

  return '';
}

export function buildBankLogoPath(bankAccountId: string, file: File) {
  const cleanId = bankAccountId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'bank';
  return `${cleanId}/logo.${getLogoExtension(file)}`;
}

export function getBankLogoPublicUrl(path: string | null | undefined) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return supabase.storage.from(BANK_LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

type UploadBankLogoOptions = {
  removePrevious?: boolean;
};

export async function uploadBankLogo(
  bankAccountId: string,
  file: File,
  previousPath?: string | null,
  options: UploadBankLogoOptions = {},
) {
  const validationMessage = validateBankLogoFile(file);
  if (validationMessage) throw new Error(validationMessage);

  const nextPath = buildBankLogoPath(bankAccountId, file);
  const { error } = await supabase.storage
    .from(BANK_LOGOS_BUCKET)
    .upload(nextPath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || 'Logo bank gagal diupload.');
  }

  if (options.removePrevious !== false && previousPath && previousPath !== nextPath && !/^https?:\/\//i.test(previousPath)) {
    await supabase.storage.from(BANK_LOGOS_BUCKET).remove([previousPath]).catch(() => undefined);
  }

  return nextPath;
}

export async function deleteBankLogo(path: string | null | undefined) {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith('data:')) return;
  await supabase.storage.from(BANK_LOGOS_BUCKET).remove([path]);
}

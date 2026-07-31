import { supabase } from '@/lib/supabaseClient';

export const PLATFORM_LOGOS_BUCKET = 'platform-logos';

const LOGO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function getLogoExtension(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function validatePlatformLogoFile(file: File) {
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    return 'Logo wajib berupa PNG, JPG, atau WebP.';
  }

  if (file.size > 1.5 * 1024 * 1024) {
    return 'Ukuran logo maksimal 1.5 MB.';
  }

  return '';
}

export function buildPlatformLogoPath(platformId: string, file: File) {
  const cleanId = platformId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'platform';
  return `${cleanId}/logo.${getLogoExtension(file)}`;
}

export function getPlatformLogoPublicUrl(path: string | null | undefined) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return supabase.storage.from(PLATFORM_LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

type UploadPlatformLogoOptions = {
  removePrevious?: boolean;
};

export async function uploadPlatformLogo(
  platformId: string,
  file: File,
  previousPath?: string | null,
  options: UploadPlatformLogoOptions = {},
) {
  const validationMessage = validatePlatformLogoFile(file);
  if (validationMessage) throw new Error(validationMessage);

  const nextPath = buildPlatformLogoPath(platformId, file);
  const { error } = await supabase.storage
    .from(PLATFORM_LOGOS_BUCKET)
    .upload(nextPath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || 'Logo platform gagal diupload.');
  }

  if (options.removePrevious !== false && previousPath && previousPath !== nextPath && !/^https?:\/\//i.test(previousPath)) {
    await supabase.storage.from(PLATFORM_LOGOS_BUCKET).remove([previousPath]).catch(() => undefined);
  }

  return nextPath;
}

export async function deletePlatformLogo(path: string | null | undefined) {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith('data:')) return;
  await supabase.storage.from(PLATFORM_LOGOS_BUCKET).remove([path]);
}

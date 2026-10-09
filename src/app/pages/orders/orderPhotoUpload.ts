const ORDER_PAYMENT_PROOF_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif']);
const ORDER_PAYMENT_PROOF_MAX_SOURCE_BYTES = 48 * 1024 * 1024;
const ORDER_PAYMENT_PROOF_TARGET_BYTES = 900 * 1024;
const ORDER_PAYMENT_PROOF_MAX_DIMENSIONS = [1600, 1280, 1024];
const ORDER_PAYMENT_PROOF_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58];

function getFileExtension(file: File) {
  return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function validateOrderPaymentProofFile(file: File) {
  const normalizedType = file.type.toLowerCase();
  const extension = getFileExtension(file);
  const isImageType = normalizedType.startsWith('image/');
  const isKnownImageExtension = ORDER_PAYMENT_PROOF_IMAGE_EXTENSIONS.has(extension);

  if (!isImageType && !isKnownImageExtension) {
    return 'File bukti pembayaran harus berupa gambar.';
  }

  if (file.size > ORDER_PAYMENT_PROOF_MAX_SOURCE_BYTES) {
    return `Ukuran ${file.name} ${formatMegabytes(file.size)}. Maksimal file asli ${formatMegabytes(ORDER_PAYMENT_PROOF_MAX_SOURCE_BYTES)} agar browser tetap stabil.`;
  }

  return null;
}

function loadImageElement(file: File) {
  return new Promise<{ image: HTMLImageElement; objectUrl: string }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Foto bukti pembayaran tidak bisa dibaca browser. Coba simpan ulang sebagai JPG atau PNG.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Browser gagal mengompres foto bukti pembayaran.'));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

export async function prepareOrderPaymentProofUpload(file: File, index: number) {
  const validationError = validateOrderPaymentProofFile(file);
  if (validationError) throw new Error(validationError);

  if (file.type.toLowerCase().startsWith('image/jpeg') && file.size <= ORDER_PAYMENT_PROOF_TARGET_BYTES) {
    return new File([file], `payment-proof-${index + 1}.jpg`, { type: 'image/jpeg' });
  }

  const { image, objectUrl } = await loadImageElement(file);
  try {
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const sourceMaxDimension = Math.max(naturalWidth, naturalHeight);

    for (const maxDimension of ORDER_PAYMENT_PROOF_MAX_DIMENSIONS) {
      const scale = Math.min(1, maxDimension / sourceMaxDimension);
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Browser tidak mendukung kompresi gambar.');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of ORDER_PAYMENT_PROOF_QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (blob.size <= ORDER_PAYMENT_PROOF_TARGET_BYTES) {
          return new File([blob], `payment-proof-${index + 1}.jpg`, { type: 'image/jpeg' });
        }
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new Error('Foto masih terlalu besar setelah dikompres. Coba crop bagian bukti pembayaran atau pilih foto lain.');
}

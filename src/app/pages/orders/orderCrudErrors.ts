const readErrorMessage = (error: unknown) => {
  if (!error) return '';
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return String(error);
};

const hasAny = (value: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(value));

export const getOrderCrudErrorMessage = (
  error: unknown,
  fallback = 'Gagal menyimpan pesanan. Coba ulang beberapa detik lagi.',
) => {
  const message = readErrorMessage(error).trim();
  if (!message) return fallback;

  if (
    hasAny(message, [
      /jadwal bentrok/i,
      /slot .*sudah terisi/i,
      /teknisi .*sedang/i,
      /teknisi wajib dipilih/i,
      /tidak tersedia/i,
    ])
  ) {
    return message;
  }

  if (
    hasAny(message, [
      /permission/i,
      /forbidden/i,
      /unauthorized/i,
      /\b401\b/,
      /\b403\b/,
      /tidak memiliki akses/i,
    ])
  ) {
    return 'Akun ini belum punya izin untuk menyimpan perubahan pesanan. Cek role dan permission user.';
  }

  if (
    hasAny(message, [
      /timeout/i,
      /connection terminated/i,
      /failed to fetch/i,
      /network/i,
      /load failed/i,
      /terlalu lama/i,
      /gateway/i,
      /gagal memverifikasi jadwal/i,
    ])
  ) {
    return 'Koneksi database atau server sedang lambat. Perubahan pesanan belum tersimpan, coba ulang beberapa detik lagi.';
  }

  if (
    hasAny(message, [
      /foreign key/i,
      /violates .*constraint/i,
      /invalid input syntax/i,
      /not-null/i,
      /null value/i,
      /23503/,
      /23502/,
    ])
  ) {
    return 'Ada data pesanan yang belum valid. Cek customer, layanan, cabang, teknisi, jadwal, platform, dan payment lalu simpan ulang.';
  }

  if (message.length > 180) return fallback;
  return message;
};

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

export const getProspectCrudErrorMessage = (
  error: unknown,
  fallback = 'Coba ulang beberapa detik lagi.',
) => {
  const message = readErrorMessage(error).trim();
  if (!message) return fallback;

  if (
    hasAny(message, [
      /nomor dan nama yang sama/i,
      /prospek tidak double/i,
      /exact active lead duplicate/i,
      /active duplicate/i,
    ])
  ) {
    return 'Nomor dan nama yang sama sudah ada sebagai prospek aktif. Data ini sengaja diblok supaya prospek tidak double.';
  }

  if (
    hasAny(message, [
      /jadwal bentrok/i,
      /slot .*sudah terisi/i,
      /teknisi wajib dipilih/i,
      /teknisi .*tidak tersedia/i,
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
    return 'Akun ini belum punya izin untuk menyimpan prospek. Cek role dan permission user.';
  }

  if (
    hasAny(message, [
      /timeout/i,
      /connection terminated/i,
      /failed to fetch/i,
      /network/i,
      /load failed/i,
      /server auth/i,
      /terlalu lama/i,
      /gateway/i,
    ])
  ) {
    return 'Koneksi database atau server sedang lambat. Data belum tersimpan, coba ulang beberapa detik lagi.';
  }

  if (
    hasAny(message, [
      /foreign key/i,
      /violates .*constraint/i,
      /invalid input syntax/i,
      /not-null/i,
      /null value/i,
    ])
  ) {
    return 'Ada pilihan data yang belum valid. Cek CS, platform, advertiser, kendaraan, cabang, atau teknisi lalu simpan ulang.';
  }

  if (message.length > 180) return fallback;
  return message;
};

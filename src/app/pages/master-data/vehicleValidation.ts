const VEHICLE_CHAT_LEAK_WORDS = [
  'apa',
  'berapa',
  'belum',
  'bengkel',
  'bisa',
  'dekat',
  'gagang',
  'headlamp',
  'kak',
  'kena',
  'kmrn',
  'kusam',
  'kusem',
  'mau',
  'nyala',
  'ortu',
  'pagar',
  'pas',
  'poles',
  'repair',
  'rumah',
  'saya',
  'sedang',
  'soalnya',
  'tp',
  'yang',
];

const VEHICLE_NAME_MAX_LENGTH = 80;

const normalizeWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const normalizeVehicleName = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const getVehicleNameValidationMessage = (value: unknown) => {
  const name = normalizeVehicleName(value);
  if (!name) return 'Nama tipe mobil wajib diisi.';
  if (name.length > VEHICLE_NAME_MAX_LENGTH) return `Nama tipe mobil maksimal ${VEHICLE_NAME_MAX_LENGTH} karakter.`;

  const words = normalizeWords(name);
  const leakedWords = words.filter((word) => VEHICLE_CHAT_LEAK_WORDS.includes(word));
  if (leakedWords.length >= 2) {
    return 'Nama tipe mobil terlihat seperti chat/catatan customer.';
  }

  if (words.length <= 3 && leakedWords.length >= 1) {
    return 'Nama tipe mobil terlihat seperti chat/catatan customer.';
  }

  if (words.length >= 7 && leakedWords.length > 0) {
    return 'Nama tipe mobil terlalu mirip kalimat customer.';
  }

  return null;
};

export const SPREADSHEET_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const SPREADSHEET_UPLOAD_ROW_LIMIT = 5000;

const EXCEL_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/zip',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

type SpreadsheetUploadGuardOptions = {
  label?: string;
  maxBytes?: number;
  rowLimit?: number;
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
    })} MB`;
  }

  return `${Math.ceil(bytes / 1024).toLocaleString('id-ID')} KB`;
};

export const getSpreadsheetReadRowLimit = (rowLimit = SPREADSHEET_UPLOAD_ROW_LIMIT) => rowLimit + 1;

export const validateSpreadsheetUploadFile = (
  file: File,
  options: SpreadsheetUploadGuardOptions = {},
) => {
  const label = options.label || 'File Excel';
  const maxBytes = options.maxBytes || SPREADSHEET_UPLOAD_MAX_BYTES;
  const mimeType = file.type.trim().toLowerCase();

  if (file.size <= 0) {
    throw new Error(`${label} kosong atau tidak valid.`);
  }

  if (file.size > maxBytes) {
    throw new Error(`${label} terlalu besar. Maksimal ${formatFileSize(maxBytes)} per import.`);
  }

  if (mimeType && !EXCEL_MIME_TYPES.has(mimeType)) {
    throw new Error(`${label} tidak dikenali sebagai file Excel yang valid.`);
  }
};

export const assertSpreadsheetRowLimit = (
  rows: ArrayLike<unknown>,
  options: SpreadsheetUploadGuardOptions = {},
) => {
  const label = options.label || 'Import Excel';
  const rowLimit = options.rowLimit || SPREADSHEET_UPLOAD_ROW_LIMIT;

  if (rows.length > rowLimit) {
    throw new Error(
      `${label} terlalu banyak baris. Maksimal ${rowLimit.toLocaleString('id-ID')} baris per import.`,
    );
  }
};

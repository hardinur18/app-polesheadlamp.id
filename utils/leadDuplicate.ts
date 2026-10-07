export type LeadDuplicateStatus = "Pending" | "Follow Up" | "Booking" | "Closing" | "Cancel" | string;

export type LeadDuplicateCandidate = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  status?: LeadDuplicateStatus | null;
  csId?: string | null;
  cs_id?: string | null;
};

export type LeadDuplicateMatchKind = "exact" | "phone";

export type LeadDuplicateMatch<T extends LeadDuplicateCandidate = LeadDuplicateCandidate> = {
  lead: T;
  kind: LeadDuplicateMatchKind;
};

export type LeadDuplicateResult<T extends LeadDuplicateCandidate = LeadDuplicateCandidate> = {
  normalizedName: string;
  normalizedPhone: string;
  exactMatches: T[];
  phoneMatches: T[];
  blockingMatch: T | null;
};

export const OPEN_LEAD_DUPLICATE_STATUSES = new Set(["Pending", "Follow Up", "Booking"]);

export function normalizeLeadComparablePhone(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const digits = String(value).trim().replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  if (digits.startsWith("620")) return `62${digits.slice(3)}`;
  return digits;
}

export function normalizeLeadComparableName(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");
}

export function isOpenLeadDuplicateStatus(status: unknown) {
  return typeof status === "string" && OPEN_LEAD_DUPLICATE_STATUSES.has(status);
}

export function getLeadDuplicateCsId(lead: LeadDuplicateCandidate | null | undefined) {
  if (!lead) return "";
  return lead.csId || lead.cs_id || "";
}

export function findLeadDuplicates<T extends LeadDuplicateCandidate>(
  candidate: LeadDuplicateCandidate,
  leads: readonly T[],
  options: { ignoreId?: string | null; onlyOpen?: boolean } = {},
): LeadDuplicateResult<T> {
  const normalizedName = normalizeLeadComparableName(candidate.name);
  const normalizedPhone = normalizeLeadComparablePhone(candidate.phone);
  const ignoreId = options.ignoreId || candidate.id || "";
  const onlyOpen = options.onlyOpen ?? true;

  if (!normalizedPhone) {
    return {
      normalizedName,
      normalizedPhone,
      exactMatches: [],
      phoneMatches: [],
      blockingMatch: null,
    };
  }

  const comparableLeads = leads.filter((lead) => {
    if (ignoreId && lead.id === ignoreId) return false;
    if (onlyOpen && !isOpenLeadDuplicateStatus(lead.status)) return false;
    return normalizeLeadComparablePhone(lead.phone) === normalizedPhone;
  });

  const exactMatches = comparableLeads.filter(
    (lead) => normalizedName && normalizeLeadComparableName(lead.name) === normalizedName,
  );

  return {
    normalizedName,
    normalizedPhone,
    exactMatches,
    phoneMatches: comparableLeads,
    blockingMatch: exactMatches[0] || null,
  };
}

export function formatLeadDuplicateOwnerLabel(
  lead: LeadDuplicateCandidate | null | undefined,
  resolveCsName?: (csId: string) => string | null | undefined,
) {
  if (!lead) return "CS lain";
  const csId = getLeadDuplicateCsId(lead);
  if (!csId) return "CS belum ditentukan";
  return resolveCsName?.(csId) || "CS lain";
}

export function formatLeadDuplicateWarning(
  result: LeadDuplicateResult,
  resolveCsName?: (csId: string) => string | null | undefined,
) {
  const match = result.blockingMatch || result.phoneMatches[0];
  if (!match) return "";

  const ownerLabel = formatLeadDuplicateOwnerLabel(match, resolveCsName);
  const name = typeof match.name === "string" && match.name.trim() ? match.name.trim() : "prospek lain";

  if (result.blockingMatch) {
    return `Nomor dan nama yang sama sudah ada di ${ownerLabel} sebagai ${name}. Simpan diblok agar data prospek tidak double.`;
  }

  return `Nomor ini sudah ada di ${ownerLabel} sebagai ${name}. Cek dulu sebelum membuat prospek baru.`;
}

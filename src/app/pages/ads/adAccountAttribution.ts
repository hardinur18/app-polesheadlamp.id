import type {
  AdAccount,
  AdAccountAssignment,
  AdAccountOwnerAssignment,
} from '@/app/pages/master-data/data';

export type ResolvedAdAccountAttribution = {
  account: AdAccount;
  advertiserId: string;
  platformId: string;
  subChannelId?: string;
  csId?: string;
  csAssignmentSource?: 'date' | 'latest';
  ppnRate: number;
  feeRate: number;
  missingFields: string[];
  isComplete: boolean;
};

type ResolveAdAccountAttributionParams = {
  account: AdAccount;
  date: string;
  ownerAssignments: AdAccountOwnerAssignment[];
  csAssignments: AdAccountAssignment[];
  preferredCsId?: string;
  fallbackToLatestCsAssignment?: boolean;
};

type ScopedAdAccountParams = {
  date: string;
  adAccounts: AdAccount[];
  ownerAssignments: AdAccountOwnerAssignment[];
  csAssignments: AdAccountAssignment[];
  currentUserId?: string;
  isAdminManagementUser?: boolean;
  isAdvertiserUser?: boolean;
  isCsUser?: boolean;
  scope?: {
    advertiserId?: string;
    platformId?: string;
    subChannelId?: string;
    csId?: string;
  };
  fallbackToLatestCsAssignment?: boolean;
};

export const isAssignmentActiveOnDate = (
  assignment: { startDate?: string | null; endDate?: string | null; status?: string | null },
  date: string,
) => {
  if (assignment.status && assignment.status !== 'active') return false;
  if (assignment.startDate && assignment.startDate > date) return false;
  if (assignment.endDate && assignment.endDate < date) return false;
  return true;
};

export const resolveAdAccountAttribution = ({
  account,
  date,
  ownerAssignments,
  csAssignments,
  preferredCsId,
  fallbackToLatestCsAssignment,
}: ResolveAdAccountAttributionParams): ResolvedAdAccountAttribution => {
  const ownerAssignment = ownerAssignments
    .filter(
      (assignment) =>
        assignment.adAccountId === account.id &&
        isAssignmentActiveOnDate(assignment, date),
    )
    .sort((left, right) => (right.startDate || '').localeCompare(left.startDate || ''))[0];

  const activeCsAssignments = csAssignments
    .filter(
      (assignment) =>
        assignment.adAccountId === account.id &&
        isAssignmentActiveOnDate(assignment, date),
    )
    .sort((left, right) => (right.startDate || '').localeCompare(left.startDate || ''));

  const dateMatchedCsAssignment =
    (preferredCsId && activeCsAssignments.find((assignment) => assignment.csId === preferredCsId)) ||
    activeCsAssignments[0];
  const latestCsAssignments = fallbackToLatestCsAssignment
    ? csAssignments
        .filter(
          (assignment) =>
            assignment.adAccountId === account.id &&
            (!assignment.status || assignment.status === 'active'),
        )
        .sort((left, right) => (right.startDate || '').localeCompare(left.startDate || ''))
    : [];
  const latestCsAssignment =
    (preferredCsId && latestCsAssignments.find((assignment) => assignment.csId === preferredCsId)) ||
    latestCsAssignments[0];
  const csAssignment = dateMatchedCsAssignment || latestCsAssignment;
  const csAssignmentSource = dateMatchedCsAssignment
    ? 'date'
    : csAssignment
      ? 'latest'
      : undefined;

  const advertiserId = ownerAssignment?.advertiserId || account.advertiserId || '';
  const platformId = account.platformId || '';
  const subChannelId = csAssignment?.subChannelId || account.subChannelId || undefined;
  const csId = csAssignment?.csId || undefined;
  const missingFields = [
    !advertiserId ? 'advertiser' : '',
    !platformId ? 'platform' : '',
  ].filter(Boolean);

  return {
    account,
    advertiserId,
    platformId,
    subChannelId,
    csId,
    csAssignmentSource,
    ppnRate: account.ppn || 0,
    feeRate: account.fee || 0,
    missingFields,
    isComplete: missingFields.length === 0,
  };
};

export const getScopedAdAccountAttributionsForDate = ({
  date,
  adAccounts,
  ownerAssignments,
  csAssignments,
  currentUserId,
  isAdminManagementUser,
  isAdvertiserUser,
  isCsUser,
  scope,
  fallbackToLatestCsAssignment,
}: ScopedAdAccountParams): ResolvedAdAccountAttribution[] => {
  return adAccounts
    .filter((account) => account.status === 'active')
    .map((account) =>
      resolveAdAccountAttribution({
        account,
        date,
        ownerAssignments,
        csAssignments,
        preferredCsId: scope?.csId || (isCsUser ? currentUserId : undefined),
        fallbackToLatestCsAssignment,
      }),
    )
    .filter((attribution) => {
      if (!isAdminManagementUser) {
        if (isAdvertiserUser && currentUserId && attribution.advertiserId !== currentUserId) {
          return false;
        }

        if (isCsUser && currentUserId && attribution.csId !== currentUserId) {
          return false;
        }
      }

      if (scope?.advertiserId && attribution.advertiserId !== scope.advertiserId) return false;
      if (scope?.platformId && attribution.platformId !== scope.platformId) return false;
      if (scope?.subChannelId && attribution.subChannelId !== scope.subChannelId) return false;
      if (scope?.csId && attribution.csId !== scope.csId) return false;

      return true;
    })
    .sort((left, right) => left.account.accountName.localeCompare(right.account.accountName));
};

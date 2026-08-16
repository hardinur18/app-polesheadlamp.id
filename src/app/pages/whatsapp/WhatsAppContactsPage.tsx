import React from 'react';
import {
  AlertTriangle,
  Check,
  Loader2,
  Phone,
  RefreshCcw,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { createDataTableColumns, DataTable } from '@/app/components/ui/data-table';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
import { MasterDataTableTitle } from '@/app/components/ui/master-data-table-title';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { cn } from '@/app/components/ui/utils';
import {
  fetchWhatsAppContacts,
  type WhatsAppAccount,
  type WhatsAppContact,
  type WhatsAppProvider,
} from '@/app/services/whatsappModuleService';
import { useMasterData } from '@/app/pages/master-data/context';
import {
  ProviderBadge,
  formatDateTime,
  formatNumber,
  formatPhoneNumber,
  getProviderLabel,
  WhatsAppContactAvatar,
} from './components/whatsappModuleShared';
import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import { useWhatsAppOverview } from './useWhatsAppOverview';

const ALL_CS_FILTER = 'all';
const UNASSIGNED_CS_FILTER = '__unassigned';

type CsFilterValue = typeof ALL_CS_FILTER | typeof UNASSIGNED_CS_FILTER | string;
type ContactRow = WhatsAppContact & { duplicateCount: number };
type ContactTab = 'all' | 'named' | 'unnamed' | 'mapped' | 'unmapped';
type AccountOwner = {
  id: string | null;
  displayName: string;
  whatsappNumber: string | null;
  assignmentStatus: string | null;
};

const PROVIDER_FILTERS: Array<{ id: 'all' | WhatsAppProvider; label: string }> = [
  { id: 'all', label: 'Semua provider' },
  { id: 'kirimdev', label: 'Kirimdev' },
  { id: 'meta', label: 'Meta langsung' },
];

const AVATAR_COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function normalizePhoneKey(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function normalizeComparablePhoneNumber(value: string | null | undefined) {
  const normalized = normalizePhoneKey(value);
  if (!normalized) return '';
  if (normalized.startsWith('0')) return `62${normalized.slice(1)}`;
  if (normalized.startsWith('8')) return `62${normalized}`;
  return normalized;
}

function getContactGroupKey(contact: WhatsAppContact) {
  const phoneKey = normalizePhoneKey(contact.phoneNumber) || normalizePhoneKey(contact.id);
  return `${contact.channelId}:${phoneKey || contact.id}`;
}

function isNewerContact(left: WhatsAppContact, right: WhatsAppContact) {
  return (left.updatedAt || '').localeCompare(right.updatedAt || '') > 0;
}

function getContactName(contact: WhatsAppContact) {
  const name = contact.name?.trim();
  if (name && name !== '.' && name !== '-' && !/^\d+$/.test(name)) return name;
  return formatPhoneNumber(contact.phoneNumber) || 'Kontak WhatsApp';
}

function hasContactName(contact: WhatsAppContact) {
  const name = contact.name?.trim();
  return Boolean(name && name !== '.' && name !== '-' && !/^\d+$/.test(name));
}

function getContactCsLabel(contact: WhatsAppContact) {
  return contact.csDisplayName?.trim() || 'Belum ada CS';
}

function getContactAccountLabel(contact: WhatsAppContact) {
  return (
    contact.accountLabel?.trim() ||
    contact.accountPhoneNumber?.trim() ||
    contact.phoneNumberId?.trim() ||
    contact.channelId
  );
}

function getAccountChannelId(account: WhatsAppAccount) {
  return account.id || `whatsapp:${account.phoneNumberId}`;
}

function getAccountLabel(account: WhatsAppAccount) {
  const label = account.label
    ?.replace(/\s*\u00e2\u20ac\u00a2\s*/g, ' - ')
    .replace(/\s*â€¢\s*/g, ' - ')
    .trim();
  return label || account.displayPhoneNumber || account.phoneNumberId || 'WhatsApp account';
}

function getAccountComparablePhoneNumber(account: WhatsAppAccount) {
  return (
    normalizeComparablePhoneNumber(account.csWhatsappNumber) ||
    normalizeComparablePhoneNumber(account.displayPhoneNumber) ||
    normalizeComparablePhoneNumber(account.label) ||
    normalizeComparablePhoneNumber(account.phoneNumberId)
  );
}

function getUserDisplayName(user: any) {
  return user.csDisplayName?.trim() || user.name?.trim() || user.email?.trim() || 'CS';
}

function buildUserOwnerByPhoneNumber(users: any[]) {
  const ownerMap = new Map<string, AccountOwner & { priority: number }>();

  users.forEach((user) => {
    const basePriority = (user.status === 'active' ? 20 : 0) + (user.role === 'CS' ? 10 : 0);
    const displayName = getUserDisplayName(user);
    const candidates = [
      {
        key: normalizeComparablePhoneNumber(user.csWhatsappNumber),
        whatsappNumber: user.csWhatsappNumber || '',
        priority: 100 + basePriority,
      },
      {
        key: normalizeComparablePhoneNumber(user.phone),
        whatsappNumber: user.phone || '',
        priority: 10 + basePriority,
      },
    ];

    candidates.forEach((candidate) => {
      if (!candidate.key) return;
      const current = ownerMap.get(candidate.key);
      if (current && current.priority >= candidate.priority) return;
      ownerMap.set(candidate.key, {
        id: user.id || null,
        displayName,
        whatsappNumber: candidate.whatsappNumber || null,
        assignmentStatus: user.csAssignmentStatus || null,
        priority: candidate.priority,
      });
    });
  });

  return ownerMap;
}

function resolveAccountOwner(
  account: WhatsAppAccount,
  ownerByPhoneNumber: Map<string, AccountOwner & { priority: number }>,
): AccountOwner | null {
  if (account.csProfileId || account.csDisplayName?.trim()) {
    return {
      id: account.csProfileId || null,
      displayName: account.csDisplayName?.trim() || 'CS',
      whatsappNumber: account.csWhatsappNumber || account.displayPhoneNumber || null,
      assignmentStatus: account.csAssignmentStatus || null,
    };
  }

  const accountPhoneNumber = getAccountComparablePhoneNumber(account);
  return accountPhoneNumber ? ownerByPhoneNumber.get(accountPhoneNumber) || null : null;
}

function isWhatsAppAccountApiConnected(account: WhatsAppAccount) {
  return account.status !== 'not_configured';
}

function buildConnectedCsOptionMap(accounts: WhatsAppAccount[], users: any[]) {
  const ownerByPhoneNumber = buildUserOwnerByPhoneNumber(users);
  const optionMap = new Map<string, { id: string; label: string; count: number }>();

  accounts.forEach((account) => {
    if (!isWhatsAppAccountApiConnected(account)) return;
    const owner = resolveAccountOwner(account, ownerByPhoneNumber);
    if (!owner?.id) return;
    optionMap.set(owner.id, {
      id: owner.id,
      label: owner.displayName,
      count: 0,
    });
  });

  return optionMap;
}

function enrichContactsWithAccountOwners(
  contacts: ContactRow[],
  accounts: WhatsAppAccount[],
  users: any[],
) {
  const ownerByPhoneNumber = buildUserOwnerByPhoneNumber(users);
  const accountByChannel = new Map(accounts.map((account) => [getAccountChannelId(account), account]));
  const ownerByChannel = new Map<string, AccountOwner>();

  accounts.forEach((account) => {
    const owner = resolveAccountOwner(account, ownerByPhoneNumber);
    if (owner) ownerByChannel.set(getAccountChannelId(account), owner);
  });

  return contacts.map((contact) => {
    const account = accountByChannel.get(contact.channelId);
    const owner = ownerByChannel.get(contact.channelId);
    if (!account && !owner) return contact;

    return {
      ...contact,
      accountLabel: contact.accountLabel || (account ? getAccountLabel(account) : null),
      accountPhoneNumber:
        contact.accountPhoneNumber || account?.displayPhoneNumber || account?.phoneNumberId || null,
      csProfileId: contact.csProfileId || owner?.id || null,
      csDisplayName: contact.csDisplayName || owner?.displayName || null,
      csWhatsappNumber: contact.csWhatsappNumber || owner?.whatsappNumber || null,
      csAssignmentStatus: contact.csAssignmentStatus || owner?.assignmentStatus || null,
    };
  });
}

function getAvatarClassName(contact: WhatsAppContact) {
  const key = getContactGroupKey(contact);
  const index = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getContactAvatarUrl(contact: WhatsAppContact) {
  return contact.avatarUrl || contact.profilePictureUrl || null;
}

function buildContactRows(contacts: WhatsAppContact[]): ContactRow[] {
  const grouped = new Map<string, { contact: WhatsAppContact; count: number }>();

  contacts.forEach((contact) => {
    const key = getContactGroupKey(contact);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { contact, count: 1 });
      return;
    }

    grouped.set(key, {
      contact: isNewerContact(contact, current.contact) ? contact : current.contact,
      count: current.count + 1,
    });
  });

  return Array.from(grouped.values())
    .map(({ contact, count }) => ({ ...contact, duplicateCount: count }))
    .sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt || ''));
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'baru saja';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} hari lalu`;
  return formatDateOnly(value);
}

function CsOwnerBadge({ contact }: { contact: WhatsAppContact }) {
  const mapped = Boolean(contact.csProfileId);
  return (
    <span
      className={cn(
        'inline-flex h-7 max-w-[180px] items-center rounded-full border px-3 text-xs font-semibold',
        mapped
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
          : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400',
      )}
    >
      <span className="truncate">{getContactCsLabel(contact)}</span>
    </span>
  );
}

function FilterCount({ value }: { value: number }) {
  return (
    <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
      {formatNumber(value)}
    </span>
  );
}

export function WhatsAppContactsPage() {
  const { users, currentUser, currentRole } = useMasterData();
  const {
    data: overviewData,
    refreshing: overviewRefreshing,
    reload: reloadOverview,
  } = useWhatsAppOverview();
  const [contacts, setContacts] = React.useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [providerFilter, setProviderFilter] = React.useState<'all' | WhatsAppProvider>('all');
  const [csFilter, setCsFilter] = React.useState<CsFilterValue>(ALL_CS_FILTER);
  const [tabFilter, setTabFilter] = React.useState<ContactTab>('all');

  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const payload = await fetchWhatsAppContacts();
      setContacts(payload.contacts);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar kontak WhatsApp.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const accounts = React.useMemo(() => overviewData?.accounts || [], [overviewData?.accounts]);
  const contactRows = React.useMemo(
    () => enrichContactsWithAccountOwners(buildContactRows(contacts), accounts, users),
    [accounts, contacts, users],
  );
  const isCsScopedUser =
    (currentRole === 'CS' || currentUser?.role === 'CS') && Boolean(currentUser?.id);
  const visibleContactRows = React.useMemo(() => {
    if (!isCsScopedUser || !currentUser?.id) return contactRows;
    return contactRows.filter((contact) => contact.csProfileId === currentUser.id);
  }, [contactRows, currentUser?.id, isCsScopedUser]);
  const isRefreshing = refreshing || overviewRefreshing;

  const refreshAll = React.useCallback(async () => {
    await Promise.all([load({ silent: true }), reloadOverview({ silent: true })]);
  }, [load, reloadOverview]);

  const namedCount = React.useMemo(
    () => visibleContactRows.filter((contact) => hasContactName(contact)).length,
    [visibleContactRows],
  );
  const unmappedCount = React.useMemo(
    () => visibleContactRows.filter((contact) => !contact.csProfileId).length,
    [visibleContactRows],
  );
  const mappedCount = visibleContactRows.length - unmappedCount;
  const duplicateCount = React.useMemo(
    () =>
      visibleContactRows.reduce(
        (total, contact) => total + Math.max(contact.duplicateCount - 1, 0),
        0,
      ),
    [visibleContactRows],
  );

  const csOptions = React.useMemo(() => {
    const optionMap = buildConnectedCsOptionMap(accounts, users);

    contactRows.forEach((contact) => {
      if (!contact.csProfileId) return;
      const current = optionMap.get(contact.csProfileId);
      if (!current) return;
      optionMap.set(contact.csProfileId, {
        id: contact.csProfileId,
        label: current.label || contact.csDisplayName?.trim() || 'CS',
        count: current.count + 1,
      });
    });

    return Array.from(optionMap.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [accounts, contactRows, users]);

  const filteredContacts = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleContactRows.filter((contact) => {
      if (providerFilter !== 'all' && contact.provider !== providerFilter) return false;
      if (!isCsScopedUser) {
        if (csFilter === UNASSIGNED_CS_FILTER && contact.csProfileId) return false;
        if (
          csFilter !== ALL_CS_FILTER &&
          csFilter !== UNASSIGNED_CS_FILTER &&
          contact.csProfileId !== csFilter
        ) {
          return false;
        }
      }
      if (tabFilter === 'named' && !hasContactName(contact)) return false;
      if (tabFilter === 'unnamed' && hasContactName(contact)) return false;
      if (tabFilter === 'mapped' && !contact.csProfileId) return false;
      if (tabFilter === 'unmapped' && contact.csProfileId) return false;
      if (!query) return true;

      const haystack = [
        contact.name,
        contact.phoneNumber,
        contact.email,
        contact.provider,
        getProviderLabel(contact.provider),
        getContactCsLabel(contact),
        getContactAccountLabel(contact),
        contact.phoneNumberId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [csFilter, isCsScopedUser, providerFilter, search, tabFilter, visibleContactRows]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    providerFilter !== 'all' ||
    (!isCsScopedUser && csFilter !== ALL_CS_FILTER) ||
    tabFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setProviderFilter('all');
    setCsFilter(ALL_CS_FILTER);
    setTabFilter('all');
  };

  const contactTabs: Array<{ id: ContactTab; label: string; count: number }> = [
    { id: 'all', label: 'Semua', count: visibleContactRows.length },
    { id: 'named', label: 'Bernama', count: namedCount },
    { id: 'unnamed', label: 'Tanpa Nama', count: visibleContactRows.length - namedCount },
    { id: 'mapped', label: 'Terhubung CS', count: mappedCount },
    { id: 'unmapped', label: 'Belum CS', count: unmappedCount },
  ];
  const csSelectValue = isCsScopedUser ? currentUser?.id || ALL_CS_FILTER : csFilter;
  const currentCsLabel = currentUser ? getUserDisplayName(currentUser) : 'CS';

  return (
    <WhatsAppModuleFrame
      activeId="whatsapp-contacts"
      badges={['WhatsApp', 'Kontak']}
      stats={[
        {
          label: 'Total Kontak',
          value: formatNumber(visibleContactRows.length),
          hint: 'Nomor unik dari semua akun aktif.',
        },
        {
          label: 'Kontak Bernama',
          value: formatNumber(namedCount),
          hint: 'Kontak dengan nama yang valid.',
        },
        {
          label: 'Terhubung CS',
          value: formatNumber(mappedCount),
          hint: 'Kontak yang sudah punya owner.',
        },
        {
          label: 'Belum CS',
          value: formatNumber(unmappedCount),
          hint: 'Perlu dipetakan ke akun CS.',
        },
      ]}
      actions={
        <Button
          type="button"
          className="h-12 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-700 px-5 text-white shadow-[0_16px_34px_rgba(2,132,199,0.24)] hover:from-sky-500 hover:to-blue-800"
          onClick={() => void refreshAll()}
          disabled={loading || isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      }
    >
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Daftar kontak belum berhasil dimuat.</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      ) : null}

      <Card className="rounded-[28px] border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4">
          <div className="flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/40">
            {contactTabs.map((tab) => {
              const active = tabFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabFilter(tab.id)}
                  className={cn(
                    'inline-flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all',
                    active
                      ? 'border border-blue-200 bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                  )}
                >
                  {tab.label}
                  <FilterCount value={tab.count} />
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_260px_128px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, nomor, email, akun, atau CS..."
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 text-base shadow-sm dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <Select
              value={providerFilter}
              onValueChange={(value) => setProviderFilter(value as 'all' | WhatsAppProvider)}
            >
              <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-white px-5 text-base font-semibold shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_FILTERS.map((filter) => (
                  <SelectItem key={filter.id} value={filter.id}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={csSelectValue} onValueChange={setCsFilter} disabled={isCsScopedUser}>
              <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-white px-5 text-base font-semibold shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <SelectValue placeholder="Filter CS" />
              </SelectTrigger>
              <SelectContent>
                {isCsScopedUser ? (
                  <SelectItem value={currentUser?.id || ALL_CS_FILTER}>
                    {currentCsLabel} ({formatNumber(visibleContactRows.length)})
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value={ALL_CS_FILTER}>Semua CS</SelectItem>
                    {csOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} ({formatNumber(option.count)})
                      </SelectItem>
                    ))}
                    <SelectItem value={UNASSIGNED_CS_FILTER}>
                      Belum CS ({formatNumber(unmappedCount)})
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-2xl border-slate-200 bg-white px-5 text-base font-semibold shadow-sm dark:border-slate-800 dark:bg-slate-950"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 px-6 py-5">
          <MasterDataTableTitle
            title="Data Kontak WhatsApp"
            count={formatNumber(filteredContacts.length)}
            icon={Users}
            variant="active"
          />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Menampilkan kontak dari akun WhatsApp yang aktif dan sudah disatukan dari duplikasi nomor.
            {duplicateCount > 0 ? ` ${formatNumber(duplicateCount)} data duplikat digabung.` : ''}
          </p>
        </div>

        <DataTable
          columns={createDataTableColumns(['number', 'name', 'text', 'status', 'status', 'text', 'date'])}
          primaryLines={2}
          secondaryLines={2}
          rowMinHeight={88}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>CS</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 7 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="mx-auto h-4 w-4" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="mx-auto h-7 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="mx-auto h-7 w-28 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-72 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 text-slate-500">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        Belum ada kontak yang sesuai.
                      </div>
                      <p className="text-sm leading-6">
                        Kontak akan muncul setelah event inbound masuk, lalu bisa difilter berdasarkan provider dan CS.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact, index) => {
                  const createdAt = contact.createdAt || contact.updatedAt;
                  return (
                    <TableRow key={getContactGroupKey(contact)}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <WhatsAppContactAvatar
                            src={getContactAvatarUrl(contact)}
                            name={getContactName(contact)}
                            phone={contact.phoneNumber}
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold',
                              getAvatarClassName(contact),
                            )}
                          />
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                                {getContactName(contact)}
                              </span>
                              {contact.duplicateCount > 1 ? (
                                <Badge variant="outline" className="h-5 shrink-0 rounded-full px-1.5 text-[10px]">
                                  x{formatNumber(contact.duplicateCount)}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{formatPhoneNumber(contact.phoneNumber)}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-300">
                          {contact.email?.trim() || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <ProviderBadge provider={contact.provider} />
                          {contact.csProfileId ? (
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                              <Check className="mr-1 h-3 w-3" />
                              CS
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CsOwnerBadge contact={contact} />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {getProviderLabel(contact.provider)}
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Smartphone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{getContactAccountLabel(contact)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatRelativeDate(createdAt)}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-500" title={formatDateTime(createdAt)}>
                          {formatDateOnly(createdAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DataTable>
      </Card>
    </WhatsAppModuleFrame>
  );
}

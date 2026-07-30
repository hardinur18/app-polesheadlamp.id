import React from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalFormSection,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
  RequiredLabel,
} from '@/app/components/ui/operational-page';

type OperationalModuleTemplateProps = {
  onCreate?: () => void;
};

const rows: Array<{ id: string; name: string; status: string }> = [];

export function OperationalModuleTemplate({ onCreate }: OperationalModuleTemplateProps) {
  return (
    <OperationalPageShell>
      <OperationalPageHeader
        eyebrow="Module"
        icon={ClipboardList}
        title="Nama Modul"
        subtitle="Deskripsi singkat modul dan workflow utama."
        actions={
          <Button className="h-9 bg-blue-600 text-white hover:bg-blue-700" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Data
          </Button>
        }
      />

      <OperationalKpiGrid>
        <OperationalKpiCard label="Total" value="0" icon={ClipboardList} />
        <OperationalKpiCard label="Aktif" value="0" tone="emerald" />
        <OperationalKpiCard label="Pending" value="0" tone="amber" />
        <OperationalKpiCard label="Masalah" value="0" tone="rose" />
      </OperationalKpiGrid>

      <OperationalTableCard>
        <OperationalFilterPanel className="rounded-none border-0 border-b border-slate-100 p-4 shadow-none dark:border-slate-800 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="h-9 pl-9" placeholder="Cari data..." />
            </div>
            <Button variant="outline" className="h-9 bg-white">
              Filter
            </Button>
          </div>
        </OperationalFilterPanel>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow className="border-b border-slate-200 hover:bg-transparent dark:border-slate-800">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <OperationalEmptyState
                      icon={ClipboardList}
                      title="Belum ada data"
                      description="Tambahkan data pertama untuk mulai memakai modul ini."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </OperationalTableCard>

      <OperationalFormSection title="Form Section" description="Gunakan section ini untuk form drawer atau dialog.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <RequiredLabel>Nama Field</RequiredLabel>
            <Input className="h-10" placeholder="Isi data" />
          </label>
          <label className="space-y-2">
            <RequiredLabel required={false}>Field Opsional</RequiredLabel>
            <Input className="h-10" placeholder="Opsional" />
          </label>
        </div>
      </OperationalFormSection>
    </OperationalPageShell>
  );
}

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rawName = process.argv.slice(2).join(' ');

if (!rawName) {
  console.error('Usage: npm run module:new -- NamaModul');
  process.exit(1);
}

const toPascalCase = (value) =>
  value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const toTitle = (value) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const componentName = toPascalCase(rawName);
const title = toTitle(rawName);
const fileName = `${componentName}Page.tsx`;
const targetDir = path.join(process.cwd(), 'src', 'app', 'pages', 'generated');
const targetPath = path.join(targetDir, fileName);

if (existsSync(targetPath)) {
  console.error(`Module already exists: ${targetPath}`);
  process.exit(1);
}

const source = `import React from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '@/app/components/ui/operational-page';

export function ${componentName}Page() {
  return (
    <OperationalPageShell>
      <OperationalPageHeader
        eyebrow="Module"
        icon={ClipboardList}
        title="${title}"
        subtitle="Kelola data ${title.toLowerCase()} dengan standar Operational Module Framework."
        actions={
          <Button className="h-9 bg-blue-600 text-white hover:bg-blue-700">
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

        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-900">
            <TableRow className="border-b border-slate-200 hover:bg-transparent dark:border-slate-800">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3}>
                <OperationalEmptyState
                  icon={ClipboardList}
                  title="Belum ada data"
                  description="Tambahkan data pertama untuk mulai memakai modul ini."
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </OperationalTableCard>
    </OperationalPageShell>
  );
}
`;

await mkdir(targetDir, { recursive: true });
await writeFile(targetPath, source, { encoding: 'utf8' });

console.log(`Created ${path.relative(process.cwd(), targetPath)}`);

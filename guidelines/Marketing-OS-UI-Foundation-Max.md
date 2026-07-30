# Marketing OS UI Foundation Max

Dokumen ini adalah source of truth khusus untuk workspace `Marketing OS` di project `Polesheadlamp.id`.

Tujuannya:
- memaksa hierarchy visual yang konsisten antar workspace Marketing OS
- memutus kebiasaan styling manual per halaman
- memastikan host app dan Marketing OS bisa hidup berdampingan tanpa saling merusak

## Source Of Truth

- Runtime theme tokens: `src/marketing-os/foundation/theme.css`
- Token mirror TypeScript: `src/marketing-os/design-system/tokens.ts`
- Shell scope: `src/marketing-os/components/MarketingOsShell.tsx`
- Page layout contract: `src/marketing-os/app-shell/MarketingOsPageLayout.tsx`
- Primitive surface: `src/marketing-os/shared/ui/SurfaceCard.tsx`
- Primitive hero: `src/marketing-os/shared/ui/WorkspaceHero.tsx`
- Primitive section: `src/marketing-os/shared/ui/WorkspaceSection.tsx`
- Primitive table shell: `src/marketing-os/shared/ui/DataTablePanel.tsx`
- Shared metric primitive: `src/marketing-os/shared/ui/MetricCard.tsx`
- Shared control bar: `src/marketing-os/shared/ui/GlobalControlBar.tsx`
- Shared drawer: `src/marketing-os/shared/ui/ContextDrawer.tsx`

## Prinsip Wajib

1. Semua halaman Marketing OS harus hidup di dalam `.marketing-os-shell`.
2. Semua page harus memakai `MarketingOsPageLayout`.
3. Semua blok utama harus memakai primitive shared, bukan `Card` host yang distyling langsung.
4. Font heading, body, dan mono hanya boleh diambil dari token Marketing OS.
5. Page tidak boleh hardcode spacing, radius, atau shadow kalau sudah ada token.
6. Jika butuh pola baru, tambahkan primitive shared dulu baru pakai di page.

## Hierarchy Yang Dipaksa

1. `MarketingOsShell`
   Scope visual dan token workspace.
2. `MarketingOsPageLayout`
   Urutan: `controlBar` → `summaryStrip` → `main content`.
3. `WorkspaceHero`
   Identitas page: eyebrow, title, description, badge, state, summary metrics.
4. `WorkspaceSection`
   Grup section dengan header dan body yang ritmenya seragam.
5. `SurfaceCard` / `DataTablePanel`
   Primitive level panel, summary, dan table shell.
6. `MetricCard`, `AlertCard`, `InsightCard`, `ContextDrawer`
   Primitive turunan untuk kebutuhan operasional khusus.

## Token Dasar

Typography:
- Heading: `Space Grotesk`
- Body: `Manrope`
- Mono: `IBM Plex Mono`

Spacing:
- Shell padding: `24px`
- Section gap: `24px`
- Grid gap: `16px`
- Item gap: `12px`

Radius:
- Shell: `24px`
- Card: `24px`
- Control/Input/Button: `20px`
- Drawer: `30px`
- Badge/Pill: `999px`

Shadow:
- Card: `0 10px 24px rgb(25 28 29 / 0.04)`
- Raised: `0 16px 36px rgb(25 28 29 / 0.07)`
- Overlay: `0 24px 56px rgb(25 28 29 / 0.10)`

## Primitive Yang Wajib Dipakai

### SurfaceCard

Gunakan untuk semua panel utama dan nested.

Variant:
- `tone="panel"` untuk panel utama
- `tone="muted"` untuk nested panel
- `tone="raised"` untuk drawer atau overlay surface

Padding:
- `sm`
- `md`
- `lg`

### WorkspaceHero

Gunakan di atas semua workspace besar.

Isi minimal:
- eyebrow
- title
- description
- badges

Opsional:
- state strip
- metric summary
- action slot

### WorkspaceSection

Gunakan untuk semua section utama page.

Isi minimal:
- eyebrow atau title
- body

Opsional:
- description
- action slot

### DataTablePanel

Gunakan untuk semua area table besar.

Struktur:
- header copy
- meta / toolbar
- scroll body

Aturan:
- jangan taruh `Card` lalu header manual lagi kalau kasusnya table
- semua table utama harus dibungkus `DataTablePanel`

## Larangan

Jangan lakukan ini di page Marketing OS:
- `px-[14px]`, `text-[11px]`, `rounded-2xl`, `shadow-sm` acak tanpa alasan
- `Card` host dipakai langsung untuk panel utama
- font inline selain token Marketing OS
- section header custom per halaman
- membuat page hero sendiri-sendiri

## Refactor Order

Urutan migrasi yang benar:

1. `Command Center`
2. `Ads Monitoring`
3. `Conversation Hub`
4. `Lead Intelligence`
5. `AI Action Center`
6. `Order Automation`
7. `Creative & Content Center`

## Audit Cepat

Sebelum workspace dianggap sehat:
- Apakah page punya `WorkspaceHero`?
- Apakah semua section utama memakai `WorkspaceSection`?
- Apakah panel utama memakai `SurfaceCard` atau `DataTablePanel`?
- Apakah title memakai font heading Marketing OS?
- Apakah body memakai font body Marketing OS?
- Apakah spacing antar section konsisten `24px`?
- Apakah card utama radius `24px`?
- Apakah table shell standar dipakai?

## Catatan

Dokumen ini harus diperbarui setiap kali ada primitive baru atau token baru yang mengubah struktur dasar Marketing OS.

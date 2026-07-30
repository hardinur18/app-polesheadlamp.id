# UI Foundation Modules

Dokumen ini mencatat modul UI foundation Polesheadlamp.id v2, komponen/class yang dipakai, dan halaman yang sudah mengadopsinya. Update setiap kali satu modul selesai dipoles.

## Prinsip Global

- Rasa visual: ringan, modern, operational app, bukan landing page.
- Font utama: Plus Jakarta Sans, mengikuti token Management Internal Tokotemansaya.
- Base body: `15px`, line-height `1.55`, heading tanpa negative tracking kecuali page H1 operational `-0.02em`.
- Background app: off-white lembut `#fbfcfe`.
- Primary color: biru logo Polesheadlamp, dengan cyan/blue highlight dan aksen kuning hanya seperlunya.
- Komponen shared dipakai ulang sebelum membuat style spesifik halaman.
- Motion hanya micro-interaction halus dan wajib hormat `prefers-reduced-motion`.

## Module: Auth Login

Status: selesai tahap polish awal.

Dipakai oleh:
- `src/app/pages/auth/LoginPage.tsx`
- `src/app/AuthenticatedApp.tsx`
- `src/app/App.tsx`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/pages/master-data/context/MasterDataCtx.tsx`

Komponen/class:
- `.loginShell`
- `.loginCard`
- `.loginMark`
- `.loginHeading`
- `.loginEyebrow`
- `.loginSub`
- `.loginForm`
- `.loginField`
- `.inputWithIcon`
- `.passwordToggle`
- `.loginButton`
- `.loginFoot`
- `.loginAccessNote`

Catatan:
- Login lokal dev aktif agar tidak tersangkut Supabase lama.
- Logo Polesheadlamp tetap bulat.
- Login memakai micro-animation: card entrance, logo float/aura, input focus, button hover.

## Module: Sidebar Navigation

Status: selesai tahap polish awal, collapsed clipping sudah difix.

Dipakai oleh:
- `src/app/components/Sidebar.tsx`
- `src/app/components/layout/AppLayout.tsx`

Komponen/class:
- `.sidebar`
- `.brand`
- `.brandMark`
- `.brandText`
- `.navList`
- `.navGroup`
- `.navGroupLabel`
- `.navGroupItems`
- `.navItem`
- `.navBranch`
- `.navChevron`
- `.navSubList`
- `.navSubItem`
- `.navFlyout`
- `.sidebarUser`
- `.sidebarUserProfile`
- `.userAvatar`
- `.userMeta`

Catatan:
- Sidebar full width: ringan, soft active state.
- Sidebar collapsed: item dipaksa center dan tidak boleh melebar keluar.
- Scrollbar nav disembunyikan, scroll wheel/trackpad tetap jalan.
- Avatar profil user berbentuk bulat.

## Module: Button System

Status: parity 1:1 dengan Management Internal.

Dipakai oleh:
- `src/app/components/ui/button.tsx`
- `src/app/components/Sidebar.tsx`
- `src/app/pages/master-data/tabs/BranchesTab.tsx`
- `src/app/pages/master-data/tabs/GenericMasterTab.tsx`

Komponen/class:
- `Button`
- `buttonVariants`
- `.uiButton`
- `.primaryButton`
- `.ghostButton`
- `.secondaryButton`
- `.dangerButton`
- `.successButton`
- `.linkButton`
- `.buttonSm`
- `.buttonLg`
- `.iconButton`

Catatan:
- Default action button mengikuti Management Internal: min-height `48px`, padding `0 20px`, radius `14px`, font `0.86rem`, weight `700`.
- Icon button default `40px`, icon `17px`, radius `10px`.
- Button `sm` untuk action kecil: height `38px`, icon `15px`, font `0.78rem`.
- Primary tetap memakai warna Polesheadlamp, tapi dimensi dan typography mengikuti Management.

## Module: Operational Page Header

Status: parity 1:1 dengan Management Internal.

Dipakai oleh:
- `src/app/components/ui/operational-page.tsx`
- `src/app/pages/master-data/MasterDataPage.tsx`

Komponen/class:
- `OperationalPageShell`
- `OperationalPageHeader`
- `.opsPageShell`
- `.topbar`
- `.topbarTitle`
- `.topbarActions`
- `.eyebrowLine`

Catatan:
- Header mengikuti pola `.topbar` Management Internal: flex row, gap `18px`, margin-bottom `26px`.
- Eyebrow mengikuti `.crumbLine`: `0.74rem`, weight `800`, letter spacing `0.12em`, icon inline tanpa chip.
- H1 operational: `clamp(1.9rem, 2.4vw, 2.55rem)`, weight `800`, line-height `1.1`.
- Subtitle: `0.94rem`, line-height `1.55`, muted.

## Module: Control Panel

Status: parity 1:1 dengan Management Internal.

Dipakai oleh:
- `src/app/components/ui/control-panel.tsx`
- `src/app/pages/master-data/tabs/BranchesTab.tsx`
- `src/app/pages/master-data/tabs/AreasTab.tsx`
- `src/app/pages/master-data/tabs/ServicesTab.tsx`
- `src/app/pages/master-data/tabs/GenericMasterTab.tsx`
- `src/app/pages/master-data/tabs/AdAccountTab.tsx`
- `src/app/pages/master-data/tabs/OperationalExpenseCategoriesTab.tsx`

Komponen/class:
- `ControlPanel`
- `ControlRow`
- `SearchBox`
- `FilterField`
- `.controlPanel`
- `.controlRow`
- `.searchBox`
- `.filterField`
- `.filterFieldLabel`

Catatan:
- Untuk search/filter/action toolbar yang berada sebelum table.
- Panel mengikuti Management Internal: padding `16px`, radius `20px`, gap row `10px`, control height `48px`.
- Search box memakai icon `17px`, input `0.94rem`, weight `650`, focus ring token foundation.
- Panel harus ringan, tidak heavy card.

## Module: Data Table

Status: dipakai di Master Data, siap dipakai ulang.

Dipakai oleh:
- `src/app/components/ui/data-table.tsx`
- `src/app/pages/master-data/tabs/BranchesTab.tsx`
- `src/app/pages/master-data/tabs/GenericMasterTab.tsx`

Komponen/class:
- `DataTable`
- `TableText`
- `TableActionHeader`
- `TableActionCell`
- `TableActionMenuTrigger`
- `.tablePanel`
- `.tableScroller`
- `.uiDataTableScroller`
- `.tableTextStack`
- `.tableTextPrimary`
- `.tableTextSecondary`
- `.tableActionHeader`
- `.tableActionCell`
- `.rowActions`

Catatan:
- Untuk tabel operational yang butuh scroll horizontal dan row text truncation.
- Header table kecil, uppercase, ringan.
- Row hover soft, action button ghost.

## Module: UI Tabs

Status: parity 1:1 dengan Management Internal.

Dipakai oleh:
- `src/app/components/ui/tabs.tsx`
- `src/app/pages/master-data/MasterDataPage.tsx`

Komponen/class:
- `Tabs`
- `TabsViewport`
- `TabsRail`
- `TabsTrigger`
- `TabsContent`
- `.uiTabs`
- `.uiTabsViewport`
- `.uiTabsRail`
- `.uiTabsList`
- `.uiTabsTrigger`
- `.uiTabsContent`
- `.masterDataTabs`
- `.masterDataTab`

Catatan:
- Untuk tab horizontal modern dengan overflow scroll tersembunyi.
- `TabsViewport` memberi edge fade kiri/kanan.
- `TabsRail` adalah scroll rail ringan.
- Active tab memakai soft white pill seperti active state Management Internal.
- Ukuran trigger: min-height `36px`, padding horizontal `15px`, font `0.82rem`, weight `700`.
- Icon tab disamakan di `16px`, stroke `2`, active mengikuti `var(--blue-ink)`.

## Module: Master Data Surface

Status: sedang tahap foundation, sudah diterapkan ke tab Cabang dan Generic Master.

Dipakai oleh:
- `src/app/pages/master-data/MasterDataPage.tsx`
- `src/app/pages/master-data/tabs/BranchesTab.tsx`
- `src/app/pages/master-data/tabs/GenericMasterTab.tsx`

Komponen/class:
- `OperationalPageShell`
- `OperationalPageHeader`
- `ControlPanel`
- `SearchBox`
- `DataTable`
- `TabsViewport`
- `TabsRail`
- `.masterDataTabs`
- `.masterDataTab`
- `.tablePanel`

Sudah mencakup tab:
- Cabang
- Vendor
- Tipe Mobil
- Platform Iklan
- Sub Channel
- Akun Bank
- Role

Belum final parity:
- Daerah
- Jenis Layanan
- Akun Iklan
- Kategori Biaya
- Form/modal di tiap tab
- Mobile list view detail

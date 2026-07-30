# UI Foundation Modules

Dokumen ini mencatat modul UI foundation Polesheadlamp.id v2, komponen/class yang dipakai, dan halaman yang sudah mengadopsinya. Update setiap kali satu modul selesai dipoles.

## Prinsip Global

- Rasa visual: ringan, modern, operational app, bukan landing page.
- Font utama: Plus Jakarta Sans.
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

## Module: Operational Page Header

Status: selesai tahap polish awal.

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
- Header memakai icon chip halus di eyebrow.
- H1 bukan hero-scale: max sekitar `2.42rem`, weight `780`, line-height `1.08`.
- Subtitle ringan: sekitar `0.95rem`.
- Eyebrow, title, subtitle punya staged fade-in halus.

## Module: Control Panel

Status: dipakai di Master Data, siap dipakai ulang.

Dipakai oleh:
- `src/app/components/ui/control-panel.tsx`
- `src/app/pages/master-data/tabs/BranchesTab.tsx`
- `src/app/pages/master-data/tabs/GenericMasterTab.tsx`

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

Status: dipakai di Master Data, siap dipakai ulang.

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
- Active tab memakai soft white pill.
- Icon tab punya micro animation saat active/hover dan wajib menghormati `prefers-reduced-motion`.

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

# UI Foundation Index

Status: Working reference
Date: 2026-08-04
Scope: Daftar modul UI foundation yang tersedia di app Polesheadlamp.id

## Purpose

Dokumen ini menjadi index cepat untuk melihat modul UI foundation yang sudah tersedia, file komponennya, dan aturan pemakaian utamanya.

## Core Shell Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| App Shell | `src/app/components/layout/AppLayout.tsx` | Layout utama aplikasi setelah login. |
| Sidebar Navigation | `src/app/components/Sidebar.tsx` | Navigasi kiri, group menu, submenu, collapsed state, user profile. |
| Operational Page Shell | `src/app/components/ui/operational-page.tsx` | Wrapper halaman operational. |
| Operational Page Header | `src/app/components/ui/operational-page.tsx` | Judul, subjudul, eyebrow, icon, dan action halaman. |

## Data Display Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| DataTable | `src/app/components/ui/data-table.tsx` | Tabel operational dengan column sizing, text truncation, action menu, status cell. |
| Base Table | `src/app/components/ui/table.tsx` | Primitive table, header, body, row, cell. |
| Master Data Table Title | `src/app/components/ui/master-data-table-title.tsx` | Header kartu tabel dengan title, icon, dan count. |
| Operational KPI | `src/app/components/ui/operational-page.tsx` | Grid dan card KPI operational. |
| Operational Empty State | `src/app/components/ui/operational-page.tsx` | State kosong untuk tabel/panel. |
| Operational Skeleton | `src/app/components/ui/operational-page.tsx` | Loading skeleton untuk table/card/KPI. |
| Badge | `src/app/components/ui/badge.tsx` | Badge kecil umum, tidak untuk menggantikan data teks tabel utama. |
| Indicator Badge | `src/app/components/ui/IndicatorBadge.tsx` | Badge indikator status khusus. |
| Status Badge | `src/app/components/ui/StatusBadge.tsx` | Badge status legacy. |

## Form And Control Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| Button System | `src/app/components/ui/button.tsx` | Tombol utama, outline, ghost, danger, icon, ukuran sm/lg. |
| Input | `src/app/components/ui/input.tsx` | Input teks foundation. |
| Textarea | `src/app/components/ui/textarea.tsx` | Textarea foundation. |
| Select | `src/app/components/ui/select.tsx` | Select/dropdown foundation. |
| Checkbox | `src/app/components/ui/checkbox.tsx` | Checkbox foundation. |
| Switch | `src/app/components/ui/switch.tsx` | Toggle switch foundation. |
| Label | `src/app/components/ui/label.tsx` | Label primitive. |
| Form | `src/app/components/ui/form.tsx` | Primitive form item, label, control, message. |
| Control Panel | `src/app/components/ui/control-panel.tsx` | Toolbar search/filter/action untuk halaman data. |
| Operational Filter Panel | `src/app/components/ui/operational-page.tsx` | Surface filter operational. |
| Required Label | `src/app/components/ui/operational-page.tsx` | Label dengan tanda wajib. |
| Master Data Form Header | `src/app/components/ui/master-data-ui.tsx` | Header form dialog dengan icon, title, subtitle, dan divider. |
| Master Data Form Grid | `src/app/components/ui/master-data-ui.tsx` | Grid 12 kolom untuk layout form profesional. |
| Master Data Form Field | `src/app/components/ui/master-data-ui.tsx` | Wrapper field dengan span `full`, `half`, `third`, atau `quarter`. |

## Dialog And Overlay Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| Dialog | `src/app/components/ui/dialog.tsx` | Dialog modal foundation. |
| Alert Dialog | `src/app/components/ui/alert-dialog.tsx` | Dialog konfirmasi/destructive action. |
| Master Data Form Dialog | `src/app/components/ui/master-data-ui.tsx` | Dialog form standar untuk master data dan modul operational. |
| Master Data Dialog Body | `src/app/components/ui/master-data-ui.tsx` | Body form/detail dengan scroll dan spacing standar. |
| Master Data Form Actions | `src/app/components/ui/master-data-ui.tsx` | Footer form dengan tombol batal/simpan standar. |
| Master Data Confirm Content | `src/app/components/ui/master-data-ui.tsx` | Konten dialog konfirmasi standar. |
| Unsaved Changes Dialog | `src/app/components/ui/master-data-ui.tsx` | Konfirmasi saat form punya perubahan belum disimpan. |
| Sheet | `src/app/components/ui/sheet.tsx` | Drawer samping. Hindari untuk detail/form yang sudah diminta pakai dialog modul. |
| Drawer | `src/app/components/ui/drawer.tsx` | Drawer primitive alternatif. |
| Popover | `src/app/components/ui/popover.tsx` | Floating content untuk combobox/filter kecil. |
| Dropdown Menu | `src/app/components/ui/dropdown-menu.tsx` | Dropdown primitive. Untuk action table, gunakan `TableActionMenu`. |
| Command | `src/app/components/ui/command.tsx` | Command list/searchable list untuk combobox. |
| Tooltip | `src/app/components/ui/tooltip.tsx` | Tooltip custom. |

## Navigation Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| Tabs | `src/app/components/ui/tabs.tsx` | Tab container, viewport, rail, trigger, content. |
| Collapsible | `src/app/components/ui/collapsible.tsx` | Expand/collapse primitive. |

## Media And Identity Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| Avatar | `src/app/components/ui/avatar.tsx` | Avatar user. |
| Platform Logo | `src/app/components/ui/platform-logo.tsx` | Logo platform iklan dengan fallback initials/default logo. |
| Platform Logo Legacy | `src/app/components/ui/PlatformLogo.tsx` | Variant lama logo platform. |
| Bank Logo | `src/app/components/ui/bank-logo.tsx` | Logo/initial bank. |
| Upload | `src/app/components/ui/Upload.tsx` | Upload control. |
| Map Card | `src/app/components/ui/MapCard.tsx` | Card map/location. |

## Feedback And Utility Modules

| Modul | File | Fungsi |
| --- | --- | --- |
| Alert | `src/app/components/ui/alert.tsx` | Alert inline. |
| Notice Stack | `src/app/components/ui/notice-stack.tsx` | Stack notice/info/warning. |
| Progress | `src/app/components/ui/progress.tsx` | Progress bar. |
| Skeleton | `src/app/components/ui/skeleton.tsx` | Loading placeholder. |
| Sonner | `src/app/components/ui/sonner.tsx` | Toast provider/styling. |
| Notification Bell | `src/app/components/ui/NotificationBell.tsx` | Bell notifikasi. |
| Scroll Area | `src/app/components/ui/scroll-area.tsx` | Scroll container. |
| Separator | `src/app/components/ui/separator.tsx` | Divider. |
| Calendar | `src/app/components/ui/calendar.tsx` | Calendar primitive. |
| Date Range Picker | `src/app/components/ui/date-range-picker.tsx` | Date range picker. |
| Utils | `src/app/components/ui/utils.ts` | Helper class merge. |
| Use Mobile | `src/app/components/ui/use-mobile.ts` | Hook responsive mobile. |

## Current Foundation Adoption

| Area | Status | Catatan |
| --- | --- | --- |
| Auth Login | Polished | Sudah dicatat di `docs/UI_FOUNDATION_MODULES.md`. |
| Sidebar Navigation | Polished | Collapsed clipping sudah difix. |
| Master Data | Foundation pass | DataTable, ControlPanel, Tabs, form dialog, detail dialog, action menu. |
| Inventory | Foundation pass | DataTable, Operational panels, form dialog, table pagination, detail produk dialog. |
| Reporting/Operational pages | Partial | Beberapa page sudah memakai `OperationalPageShell` dan `OperationalPageHeader`. |
| Legacy pages | Mixed | Masih ada page yang memakai heading/form/table manual. |

## Usage Rules

- Judul dan subjudul halaman operational gunakan `OperationalPageHeader`.
- Table operational gunakan `DataTable` dengan prop `columns`.
- Isi table jangan dibuat bold; pakai `TableText` untuk primary/secondary text.
- Nomor urut table memakai angka biasa tanpa leading zero.
- Action table gunakan `TableActionMenu`, bukan dropdown manual.
- Form modal gunakan `MasterDataFormDialogContent`, `MasterDataFormHeader`, `MasterDataDialogBody`, `MasterDataFormGrid`, `MasterDataFormField`, dan `MasterDataFormActions`.
- Form wide mengikuti pola master data: header di atas, divider, body grid 12 kolom, input sejajar, footer action di bawah.
- Filter/search toolbar gunakan `ControlPanel` atau `OperationalFilterPanel`.
- Status di table gunakan icon/status text ringan; hindari badge besar sebagai isi kolom utama.
- Jangan buat class visual baru jika modul foundation sudah mencakup kebutuhan.

## Related Documentation

- `docs/UI_FOUNDATION_MODULES.md`
- `File Review/modules/07-inventory.md`
- `docs/professional-hardening-guardrails.md`

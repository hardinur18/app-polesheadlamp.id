# Integrasi Iklan Blueprint Advanced Spec

## Status

- `Tanggal`: 12 April 2026
- `Fitur`: `Integrasi Iklan`
- `Dokumen pasangan`: [Integrasi-Iklan-Blueprint-P0.md](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/guidelines/Integrasi-Iklan-Blueprint-P0.md)
- `Acuan utama`: [BLUEPRINT.md](/Users/macbookair/Windsurf/LKPP-repo/LKPP%20FE%20baru/web/BLUEPRINT.md)

Dokumen ini mendetailkan `ukuran`, `jarak`, `struktur`, dan `perilaku visual` untuk fitur `Integrasi Iklan`, agar implementasi punya angka yang jelas dan tidak berubah-ubah.

Dokumen ini mengikuti semangat blueprint:

- `data-first`
- `surface hierarchy`
- `table-first workspace`
- `no decorative hero dominance`
- `filter as primary control`

---

## 1. Scope

Dokumen ini mengunci standar untuk:

- page shell internal `Integrasi Iklan`
- section header
- filter bar
- summary cards
- primary table
- glossary/reference block
- tooltip/copy hint
- combobox/select/date range controls
- loading, empty, stale, and error states

Dokumen ini belum membahas:

- chart module
- drawer detail akun
- print/export layout
- mobile offline mode

---

## 2. Framework Baseline

### 2.1 Target Blueprint-Max

- `Next.js`: `16.2.3`
- `React`: `19.2.4`
- `Tailwind CSS`: `v4`
- `TanStack Query`: `^5.80.0`
- `Zustand`: `^5.0.0`
- `Rendering`: `RSC + PPR + Suspense`

### 2.2 Repo Saat Ini

- `Vite`: `6.3.5`
- `React`: `18.3.1`
- `React Router`: `7.13.0`
- `Tailwind CSS`: `4.1.12`

### 2.3 Keputusan Implementasi

Untuk `Integrasi Iklan`, angka desain dan struktur di dokumen ini dipakai `sekarang`, walau repositori belum full Next.js.

Artinya:

- `visual contract`: ikuti blueprint sekarang
- `full framework contract`: dikejar saat migrasi besar

---

## 3. Page Layout Contract

### 3.1 Page Container

- `max-width`: `1600px`
- `desktop horizontal padding`: `32px`
- `tablet horizontal padding`: `24px`
- `mobile horizontal padding`: `16px`
- `vertical page gap`: `24px`
- `section gap`: `24px`

### 3.2 Fold Priority

Fold pertama desktop wajib menampilkan:

1. section header
2. filter bar
3. 4 summary cards
4. top rows dari table

Yang tidak boleh memenuhi fold pertama:

- glossary terbuka penuh
- panel aturan panjang
- card edukasi besar

### 3.3 Section Order

Urutan final:

1. `Section Header`
2. `Filter Bar`
3. `Summary Rail`
4. `Primary Data Table`
5. `Glossary / Reference`

---

## 4. Spacing Scale

Gunakan skala ini untuk seluruh fitur.

| Token | px | Pemakaian |
|---|---:|---|
| `space-1` | `4` | icon-gap kecil |
| `space-2` | `8` | label + hint |
| `space-3` | `12` | gap compact |
| `space-4` | `16` | padding kecil |
| `space-5` | `20` | padding input/card kecil |
| `space-6` | `24` | padding section standar |
| `space-8` | `32` | gap antar section besar |
| `space-10` | `40` | jarak hero/header besar |

### 4.1 Rule

- `card padding kecil`: `16px`
- `card padding standar`: `20px`
- `section padding`: `24px`
- `table cell horizontal`: `16px`
- `table cell vertical`: `14px`
- `filter field gap`: `16px`

---

## 5. Radius Scale

| Token | px | Pemakaian |
|---|---:|---|
| `radius-sm` | `10` | badge besar, input kecil |
| `radius-md` | `14` | select, popover kecil |
| `radius-lg` | `18` | card standar |
| `radius-xl` | `22` | summary cards |
| `radius-2xl` | `28` | main section hero/filter surface |

### 5.1 Rule

- `main cards`: `18px`
- `summary cards`: `22px`
- `filter bar surface`: `24px`
- `dropdown / popover`: `16px`
- `table wrapper`: `20px`

---

## 6. Typography Contract

Karena blueprint hanya memberi placeholder font family, fitur ini perlu baseline operasional.

### 6.1 Font Family Recommendation

- `heading`: `Inter, ui-sans-serif, system-ui, sans-serif`
- `body`: `Inter, ui-sans-serif, system-ui, sans-serif`
- `numeric emphasis`: gunakan family yang sama, `font-variant-numeric: tabular-nums` bila tersedia

### 6.2 Text Scale

| Role | Size | Line Height | Weight | Pemakaian |
|---|---:|---:|---:|---|
| `display-sm` | `32px` | `40px` | `600` | judul besar halaman |
| `heading-lg` | `24px` | `32px` | `600` | judul table section |
| `heading-md` | `20px` | `28px` | `600` | judul card/filter |
| `heading-sm` | `16px` | `24px` | `600` | label section kecil |
| `body-md` | `14px` | `22px` | `400` | deskripsi utama |
| `body-sm` | `13px` | `20px` | `400` | helper text |
| `label-sm` | `12px` | `16px` | `500` | label field |
| `micro` | `11px` | `14px` | `500` | eyebrow, meta label |

### 6.3 Numeric Scale

| Role | Size | Line Height | Weight | Pemakaian |
|---|---:|---:|---:|---|
| `metric-xl` | `36px` | `40px` | `700` | angka headline hero |
| `metric-lg` | `30px` | `36px` | `700` | total spend/burn utama |
| `metric-md` | `18px` | `24px` | `600` | angka summary kecil |
| `metric-sm` | `14px` | `20px` | `500` | angka row sekunder |

### 6.4 Case Rules

- field labels: `uppercase`, tracking `0.16em`
- table headers: `sentence case`
- badges: `sentence case`

---

## 7. Surface Hierarchy

Mengikuti blueprint:

- `Page background`: `Level 0`
- `Section card/filter/table wrapper`: `Level 1`
- `Summary cards`: `Level 2`
- `Dropdown/Popover/Tooltip`: `Level 4 floating`

### 7.1 Rule

- jangan pakai border 1px untuk memisahkan blok besar
- border tipis hanya untuk:
  - input
  - select
  - table row separator
  - badge outline

### 7.2 Shadows

Pakai shadow dari blueprint:

- `shadow-soft`: untuk section biasa
- `shadow-card`: untuk summary cards
- `shadow-float`: untuk popover/date picker/dropdown

---

## 8. Section Header Spec

`Section Header` menggantikan hero besar.

### 8.1 Ukuran

- `min-height`: `112px`
- `max-height target`: `156px`
- `padding`: `24px`
- `title max width`: `760px`
- `description max width`: `720px`
- `header action zone`: `1-2 badge/status kecil`

### 8.2 Isi Wajib

- title
- one-line description
- 2 sampai 4 badge status singkat
- opsional: sumber data aktif

### 8.3 Isi yang Dilarang

- penjelasan 2 kolom besar
- legend penuh
- glosarium penuh
- blok edukasi panjang

---

## 9. Filter Bar Spec

Filter adalah alat kerja utama.

### 9.1 Struktur

- `1 surface`
- `header kecil`
- `1 grid field`
- `1 state chip` bila filter sedang apply

### 9.2 Ukuran

- `padding`: `20px`
- `border radius`: `24px`
- `field gap`: `16px`
- `field min-height`: `40px`
- `trigger height`: `40px`
- `desktop grid`: `5 kolom`
- `tablet grid`: `2 kolom`
- `mobile grid`: `1 kolom`

### 9.3 Label

- size: `11px`
- uppercase
- tracking: `0.18em`
- weight: `500`

### 9.4 Date Range Trigger

- `height`: `40px`
- `padding-x`: `14px`
- `padding-y`: `10px`
- `icon size`: `16px`
- `display text size`: `14px`
- `radius`: `14px`

### 9.5 Select / Combobox Trigger

- `height`: `40px`
- `padding-x`: `14px`
- `font-size`: `14px`
- `radius`: `14px`
- `placeholder opacity`: `0.72`

### 9.6 Dropdown / Popover

- `min-width`: samakan trigger, jangan lebih kecil
- `max-height`: `360px`
- `item height`: `36px`
- `item padding-x`: `12px`
- `radius`: `16px`
- `shadow`: `shadow-float`

---

## 10. Summary Cards Spec

### 10.1 Jumlah

P0 wajib:

1. `Total Spend`
2. `Total Burn`
3. `Order Terbaca`
4. `Clicks`

### 10.2 Layout

- desktop: `4 card`
- tablet: `2x2`
- mobile: `1 kolom`

### 10.3 Ukuran

- `min-height`: `108px`
- `padding`: `20px`
- `radius`: `22px`
- `gap`: `16px`

### 10.4 Isi Card

- label kecil
- info hint icon kecil
- angka utama
- subcopy opsional satu baris

### 10.5 Icon

- `size`: `18px`
- pakai sebagai aksen, bukan dekorasi besar

---

## 11. Primary Data Table Spec

### 11.1 Role

Table adalah pusat fitur.

### 11.2 Wrapper

- `padding`: `20px`
- `radius`: `20px`
- `overflow-x`: aktif
- `sticky header`: wajib

### 11.3 Table Width

- `min-width`: `1120px`
- jika ditambah kolom detail P1: `1280px`

### 11.4 Header Row

- `height`: `52px`
- `font-size`: `13px`
- `weight`: `600`
- `background`: level lebih tinggi dari body
- `sticky top offset`: `0`

### 11.5 Body Row

- `min-height`: `60px`
- `vertical padding`: `14px`
- `horizontal padding`: `16px`
- `row separator`: `1px` soft only

### 11.6 Cell Rules

- numeric columns: `right aligned`
- dimension columns: `left aligned`
- currency dan percent: `tabular feel`
- helper label seperti `order` tampil di bawah angka, bukan sejajar horizontal

### 11.7 Column Width Recommendation

| Column | Width |
|---|---:|
| Platform | `92px` |
| Business Manager / Grup | `180px` |
| Akun | `180px` |
| Advertiser | `160px` |
| Spend | `136px` |
| Burn | `136px` |
| Order | `104px` |
| Clicks | `104px` |
| CTR | `88px` |
| CPL | `124px` |

### 11.8 Row Meta Labels

- `order` / `order*` / `manual`
- `font-size`: `12px`
- `margin-top`: `4px`
- `color`: semantic accent only

### 11.9 Empty State

- `min-height`: `220px`
- center aligned
- title + short description + optional reset filter CTA

---

## 12. Glossary Spec

Glossary harus sekunder.

### 12.1 Default State

- `collapsed by default`
- muncul setelah table

### 12.2 Expanded State

- grid `2 kolom` di tablet
- grid `4 kolom` di desktop
- card term padding `16px`
- radius `18px`

### 12.3 Trigger

- title
- `Istilah Acuan` badge
- chevron
- helper copy satu baris

---

## 13. Color Usage Rules

### 13.1 Accent

Accent hanya dipakai untuk:

- button aktif
- selected state
- icon aksen
- badge status
- meta source label

Jangan pakai accent sebagai background penuh section.

### 13.2 Semantic Colors

- `emerald`: live / healthy
- `amber`: fallback / warning / manual
- `blue`: exact mapping / trusted
- `indigo`: shared mapping
- `rose`: hard error

---

## 14. Interaction States

### 14.1 Hover

- `duration`: `160ms`
- naikkan surface sedikit, jangan glow

### 14.2 Focus

- outline jelas
- jangan pakai glow berlebihan
- minimal kontras `AA`

### 14.3 Loading

- summary cards: skeleton `40px` block
- table: `6-8` skeleton rows
- filter bar: tetap aktif kalau data lama masih tersedia

### 14.4 Stale State

Jika live gagal tapi snapshot ada:

- jangan kosongkan table
- tampilkan banner kecil
- tone `amber`
- copy singkat, tidak dramatis

---

## 15. Breakpoint Rules

### 15.1 Desktop `>= 1280px`

- full 5-column filter
- full 4-card summary row
- glossary 4 kolom

### 15.2 Laptop `1024px - 1279px`

- filter tetap 5 kolom jika muat, kalau tidak `3 + 2`
- summary `2 + 2`

### 15.3 Tablet `768px - 1023px`

- filter `2 kolom`
- summary `2 kolom`
- glossary `2 kolom`

### 15.4 Mobile `< 768px`

- filter `1 kolom`
- summary `1 kolom`
- table tetap scroll horizontal
- sticky summary tidak perlu

---

## 16. Accessibility Baseline

- semua input punya label
- info hint bisa diakses keyboard
- table header jelas untuk screen reader
- tooltip tidak jadi satu-satunya sumber informasi penting
- color bukan satu-satunya indikator state
- focus ring terlihat di dark mode

---

## 17. P0 Implementation Sequence

### 17.1 Layout

1. kecilkan header menjadi `section header`
2. buat filter bar final
3. poles summary cards
4. poles table wrapper
5. pindahkan glossary ke bawah dan collapse

### 17.2 Data

1. today live cache
2. historical snapshot 90 hari
3. merge range
4. stale fallback halus

### 17.3 Polish

1. sticky table header
2. width tiap kolom stabil
3. tabular alignment untuk angka
4. empty/loading/error state

---

## 18. Acceptance Criteria Advanced

Fitur dianggap lolos advanced spec jika:

1. fold pertama selalu didominasi `filter + summary + top table`
2. tidak ada section besar kosong
3. semua control memiliki ukuran konsisten
4. semua angka mudah discan secara vertikal
5. glosarium tidak lagi mengganggu alur kerja
6. histori terasa instan
7. live today tetap responsif tanpa raw API spam
8. layout stabil pada desktop, tablet, dan mobile
9. semantic colors dan label state konsisten


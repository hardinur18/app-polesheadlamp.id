# Blueprint Section Matrix for Polesheadlamp.id

Status: Reference detail
Date: 2026-04-20
Scope: Decision matrix only, no runtime change
Document role: Supporting reference for section-by-section blueprint decisions

## Purpose

Dokumen ini menerjemahkan `BLUEPRINT.md` section-by-section ke keputusan yang relevan untuk repo `Polesheadlamp.id`.

Status yang dipakai:

- `adopt`: dipakai hampir apa adanya karena prinsipnya cocok dengan repo saat ini
- `adapt`: dipakai, tetapi harus diterjemahkan ke stack dan kondisi repo sekarang
- `defer`: bernilai, tetapi belum layak dieksekusi sekarang
- `ignore`: tidak cocok dijadikan target implementasi untuk repo saat ini

## Section Decisions

| Section | Status | Decision summary | Why for this repo | Execution note |
|---|---|---|---|---|
| Section 1 - System Architecture Overview | adapt | Pakai sebagai peta layer konseptual, bukan sebagai bentuk stack literal | Repo ini memang punya frontend, server logic, database, realtime, dan integrasi | Gunakan untuk boundary thinking, bukan untuk mengubah stack |
| Section 2 - Monorepo Structure | adapt | Ambil disiplin pemisahan domain dan layer, bukan Turborepo-nya | Repo sekarang single app Vite + Supabase functions, bukan greenfield monorepo | Dokumentasikan ownership dan boundary internal sebelum mempertimbangkan split package |
| Section 3 - Dependency Manifest | defer | Jadikan referensi kategori dependency, bukan daftar package target | Paket di blueprint sangat terikat ke Next.js stack | Evaluasi hanya bila ada kebutuhan tooling atau replacement yang jelas |
| Section 4 - Configuration Files | adapt | Ambil aturan kontrak config, env, strictness, dan separation of concerns | Repo sudah punya `vite.config.ts`, env Vite, workflow deploy, dan config Supabase | Buat konvensi config target yang sesuai Vite + Cloudflare + Supabase |
| Section 5 - Database Schema Contracts | adapt | Ambil naming, migration discipline, audit fields, dan schema review rules | Repo sudah punya `supabase/migrations` dan beberapa tabel baru dengan RLS | Gunakan sebagai standard review untuk schema berikutnya |
| Section 6 - API Contract Specification | adapt | Jadikan target contract untuk Edge Functions dan service layer | Backend sekarang Hono-based, tetapi response shape dan error handling masih campur | Ini salah satu area paling layak dirapikan tanpa ganti UI |
| Section 7 - Design System Specification | adapt | Ambil governance token dan design discipline, tanpa mengubah visual saat ini | Repo punya main theme dan `marketing-os` theme yang hidup berdampingan | Gunakan untuk aturan sistem desain, bukan redesign |
| Section 8 - Rendering Architecture | ignore | Jangan diadopsi sebagai target implementasi | Isinya sangat terikat ke Next.js, RSC, PPR, dan Server Actions | Boleh dipakai hanya sebagai referensi konsep pemisahan render, bukan task aktif |
| Section 9 - Authentication and Authorization | adapt | Ambil prinsip auth boundary, route protection, dan role enforcement | Repo memakai Supabase session, bukan NextAuth + middleware Next.js | Relevan untuk kontrak permission client/server dan endpoint protection |
| Section 10 - Real-Time Architecture | adapt | Ambil prinsip scope dan governance realtime | Repo sudah memakai Supabase Realtime dan beberapa live integration endpoints | Fokus di disiplin subscription dan noise reduction, bukan ganti kanal sekarang |
| Section 11 - Background Jobs | defer | Jangan dijadikan task aktif dulu | Repo belum memakai BullMQ/Redis job architecture sebagai fondasi inti | Pertimbangkan hanya jika kebutuhan async workload benar-benar muncul |
| Section 12 - Observability | adapt | Ambil logging, error reporting, dan performance discipline | Repo masih banyak `console.*` dan observability belum seragam | Dokumentasikan target logging dan error contract dulu |
| Section 13 - CI/CD Pipeline | adapt | Ambil quality flow dan deployment discipline | Repo sudah punya workflow Cloudflare Pages dan Supabase Functions | Tambahkan quality gate bertahap tanpa merusak alur deploy sekarang |
| Section 14 - PWA Specification | adapt | Ambil sebagai kontrak PWA yang lebih formal | Repo sudah memakai `vite-plugin-pwa` | Rapikan sebagai target config, tanpa mengubah pengalaman user sekarang |
| Section 15 - Accessibility Contract | adopt | Pakai sebagai standard kualitas lintas stack | WCAG dan keyboard/accessibility checks tetap relevan untuk repo ini | Jadikan bagian dari checklist review dan no-regression |
| Section 16 - Component Architecture Rules | adapt | Ambil klasifikasi tanggung jawab komponen dan layer | Repo saat ini belum sepenuhnya terstruktur seperti blueprint | Sangat relevan untuk conventions doc dan backlog refactor |
| Section 17 - Anti-Patterns | adapt | Pakai sebagai daftar larangan yang diterjemahkan ke kondisi repo sekarang | Banyak anti-pattern blueprint nyambung dengan hotspot repo, terutama state, typing, dan boundary | Jangan dipakai sebagai alasan rewrite mendadak; gunakan sebagai review lens |
| Section 18 - Security Requirements | adapt | Pakai sebagai target keamanan bertahap | Repo sudah punya Supabase, Edge Functions, webhook, token, dan secret handling | Relevan untuk endpoint protection, env hygiene, dan validation |
| Section 19 - Setup Sequence | ignore | Tidak dipakai sebagai task implementasi | Section ini untuk bootstrap proyek baru dari nol | Repo ini sudah hidup dan tidak sedang di-bootstrap ulang |
| Section 20 - Quality Gates | adapt | Pakai sebagai target proses dan review gate | Repo saat ini belum punya typecheck/lint/test gate yang lengkap | Ini harus diterjemahkan ke fase bertahap agar aman |
| Section 21 - Glossary | adopt | Pakai sebagai referensi istilah | Membantu menjaga konsistensi bahasa teknis lintas dokumen | Tidak menghasilkan perubahan runtime |

## Summary by Priority

### Highest value to adapt first

- Section 6 - API Contract Specification
- Section 9 - Authentication and Authorization
- Section 12 - Observability
- Section 16 - Component Architecture Rules
- Section 17 - Anti-Patterns
- Section 18 - Security Requirements
- Section 20 - Quality Gates

### High value but needs careful translation

- Section 2 - Monorepo Structure
- Section 4 - Configuration Files
- Section 5 - Database Schema Contracts
- Section 7 - Design System Specification
- Section 10 - Real-Time Architecture
- Section 13 - CI/CD Pipeline
- Section 14 - PWA Specification

### Defer for now

- Section 3 - Dependency Manifest
- Section 11 - Background Jobs

### Ignore as implementation target

- Section 8 - Rendering Architecture
- Section 19 - Setup Sequence

## Practical Conclusion

`BLUEPRINT.md` paling berguna untuk repo ini saat dibaca sebagai:

- governance guide
- refactor compass
- quality and security checklist

`BLUEPRINT.md` tidak cocok dipakai sebagai:

- stack migration plan
- Next.js migration brief
- monorepo bootstrap script

## Next Document Dependency

Dokumen berikut yang harus membaca matrix ini adalah:

- `TARGET-TECHNICAL-CONVENTIONS.md`
- `NO-REGRESSION-CHECKLIST.md`
- `REFACTOR-BACKLOG.md`

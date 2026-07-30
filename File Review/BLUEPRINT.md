# FULLSTACK SYSTEM BLUEPRINT
## Universal Technical Specification — Version 2.0.0

Status: Source blueprint document
Document role: Upstream source material, not the active execution tracker

```
Classification   : AI-Executable Technical Specification
Scope            : Full-Stack Web Application — Frontend · Backend · Database · Infrastructure
Architecture     : Turborepo Monorepo · Next.js RSC · Node.js API · PostgreSQL · Redis
Rendering        : React Server Components · Partial Prerendering · Edge Runtime
Compliance       : WCAG 2.2 AA · Core Web Vitals ≥ 95 · TypeScript Strict Mode
Replaces         : Blueprint v1.0.0
```

> **HOW TO USE THIS FILE**
> Replace all `{{PLACEHOLDER}}` values with your project specifics before handing to an AI agent.
> The AI must read this document in full before writing a single line of code.

---

## VARIABLES — FILL BEFORE USE

```yaml
project:
  name:         "{{PROJECT_NAME}}"          # e.g. "Acme Portal"
  slug:         "{{PROJECT_SLUG}}"          # e.g. "acme" (lowercase, no spaces)
  org:          "{{ORG_SLUG}}"              # e.g. "acme-corp" (used in package names)
  description:  "{{PROJECT_DESCRIPTION}}"   # one sentence
  domain:       "{{PRODUCTION_DOMAIN}}"     # e.g. "portal.acme.com"
  locale:       "{{DEFAULT_LOCALE}}"        # e.g. "id" or "en"
  timezone:     "{{DEFAULT_TIMEZONE}}"      # e.g. "Asia/Jakarta"

roles:
  # Define all user roles in your system
  - id: "{{ROLE_1_ID}}"     label: "{{ROLE_1_LABEL}}"
  - id: "{{ROLE_2_ID}}"     label: "{{ROLE_2_LABEL}}"
  - id: "{{ROLE_3_ID}}"     label: "{{ROLE_3_LABEL}}"

brand:
  primary_color:  "{{BRAND_PRIMARY_HEX}}"   # e.g. "#0f172a"
  font_heading:   "{{FONT_HEADING}}"         # e.g. "Inter"
  font_body:      "{{FONT_BODY}}"            # e.g. "Inter"
```

---

## SECTION 1 — SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  Browser · PWA · Mobile WebView                                     │
│  ├─ Static assets served from CDN (Vercel Edge Network)            │
│  └─ Real-time updates via Server-Sent Events / WebSocket           │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────────────┐
│                      FRONTEND — apps/web                            │
│  Next.js 16 App Router · React 19 · TypeScript 5                   │
│  ├─ React Server Components (RSC) — data fetch on server           │
│  ├─ Partial Prerendering (PPR) — static shell + dynamic stream     │
│  ├─ Server Actions — form mutations without REST round-trip        │
│  ├─ Edge Middleware — auth guard, role redirect, rate limit        │
│  └─ API Routes (Edge Runtime) — lightweight BFF endpoints          │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Internal HTTP / RPC
┌────────────────────────▼────────────────────────────────────────────┐
│                       BACKEND — apps/api                            │
│  Node.js 22 · Hono · TypeScript 5                                  │
│  ├─ RESTful API with OpenAPI 3.1 spec                              │
│  ├─ Zod request/response validation                                │
│  ├─ JWT authentication + refresh token rotation                    │
│  ├─ Role-based access control (RBAC)                               │
│  ├─ Background jobs via BullMQ                                     │
│  └─ File upload via S3-compatible storage                          │
└──────────┬──────────────────────────┬──────────────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────────────────────┐
│   DATABASE PRIMARY  │   │           CACHE / QUEUE                  │
│   PostgreSQL 16     │   │   Redis 7                                │
│   ├─ Drizzle ORM   │   │   ├─ Session store                       │
│   ├─ Migrations    │   │   ├─ API response cache                  │
│   └─ Connection    │   │   ├─ BullMQ job queue                    │
│     Pool (pg)      │   │   └─ Pub/Sub for real-time              │
└─────────────────────┘   └──────────────────────────────────────────┘
```

---

## SECTION 2 — MONOREPO STRUCTURE

### 2.1 Turborepo Workspace Root

```
{{PROJECT_SLUG}}/                          # Turborepo workspace root
├── apps/
│   ├── web/                               # Next.js 16 — frontend portal
│   └── api/                               # Hono — REST API service
├── packages/
│   ├── ui/                                # @{{ORG_SLUG}}/ui — shared component library
│   ├── design-tokens/                     # @{{ORG_SLUG}}/design-tokens — token source of truth
│   ├── db/                                # @{{ORG_SLUG}}/db — Drizzle schema + migrations
│   ├── types/                             # @{{ORG_SLUG}}/types — shared TypeScript types
│   ├── utils/                             # @{{ORG_SLUG}}/utils — shared utility functions
│   ├── config-eslint/                     # @{{ORG_SLUG}}/config-eslint — shared lint rules
│   └── config-typescript/                 # @{{ORG_SLUG}}/config-typescript — shared tsconfig
├── tooling/
│   ├── docker/
│   │   ├── Dockerfile.web                 # Production image — frontend
│   │   ├── Dockerfile.api                 # Production image — backend
│   │   └── docker-compose.yml             # Local dev: postgres, redis, api, web
│   └── scripts/
│       ├── db-migrate.sh                  # Run migrations in all environments
│       └── seed.sh                        # Seed development database
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Lint · Typecheck · Test · Build
│       ├── chromatic.yml                  # Visual regression on PR
│       ├── deploy-staging.yml             # Auto-deploy on push to develop
│       └── deploy-production.yml          # Deploy on push to main
├── turbo.json                             # Build pipeline definition
├── package.json                           # Workspace root (no logic)
├── .nvmrc                                 # Node version pin: 22
├── .env.example                           # Environment variable contract
└── BLUEPRINT.md                           # This file
```

---

### 2.2 Frontend Application — apps/web/

```
apps/web/
├── src/
│   ├── app/                               # Next.js App Router — thin route layer only
│   │   ├── layout.tsx                     # Root layout: fonts, providers, metadata
│   │   ├── globals.css                    # Design token source of truth (Tailwind v4)
│   │   ├── page.tsx                       # / → LandingPage (RSC, static)
│   │   ├── not-found.tsx                  # Custom 404
│   │   ├── error.tsx                      # Global error boundary UI
│   │   ├── loading.tsx                    # Root Suspense fallback
│   │   ├── sitemap.ts                     # Auto-generated sitemap
│   │   ├── robots.ts                      # Robots.txt generator
│   │   │
│   │   ├── (public)/                      # Route group: no auth required
│   │   │   ├── about/page.tsx
│   │   │   ├── guide/page.tsx
│   │   │   └── help/page.tsx
│   │   │
│   │   ├── (auth)/                        # Route group: unauthenticated only
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (app)/                         # Route group: authenticated users
│   │   │   ├── layout.tsx                 # Auth guard layout
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   ├── ({{ROLE_1_ID}})/               # Route group: role-specific
│   │   │   ├── layout.tsx
│   │   │   └── {{ROLE_1_ID}}/
│   │   │       ├── dashboard/page.tsx
│   │   │       └── [feature]/page.tsx
│   │   │
│   │   └── api/                           # BFF API routes (Edge Runtime)
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── upload/route.ts
│   │       ├── stream/route.ts            # Server-Sent Events
│   │       └── health/route.ts
│   │
│   ├── design-system/                     # Visual contracts — source of truth
│   │   ├── roles.ts                       # Role definitions, theme presets
│   │   ├── site.ts                        # Brand identity, navigation
│   │   └── tokens.ts                      # Token type definitions
│   │
│   ├── components/
│   │   ├── ui/                            # Primitive layer — atomic, zero business logic
│   │   │   ├── button.tsx                 # CVA: variant(default|outline|ghost|destructive)
│   │   │   │                              #      size(xs|sm|default|lg|icon)
│   │   │   ├── card.tsx                   # CVA: tone(elevated|soft|glass) × padding(sm|md|lg)
│   │   │   ├── stat-card.tsx              # Metric card, CVA tone variants
│   │   │   ├── badge.tsx                  # CVA: variant, size
│   │   │   ├── input.tsx                  # Label, prefix, suffix, error state
│   │   │   ├── textarea.tsx
│   │   │   ├── select.tsx                 # @base-ui/react Select
│   │   │   ├── checkbox.tsx               # @base-ui/react Checkbox
│   │   │   ├── switch.tsx                 # @base-ui/react Switch
│   │   │   ├── radio-group.tsx            # @base-ui/react RadioGroup
│   │   │   ├── slider.tsx                 # @base-ui/react Slider
│   │   │   ├── form-field.tsx             # label + input + error message wrapper
│   │   │   ├── field-message.tsx          # Error/info/success message
│   │   │   ├── notice.tsx                 # info|warning|error|success banner
│   │   │   ├── section-header.tsx         # eyebrow + title + description + actions
│   │   │   ├── table.tsx                  # thead, tbody, row, cell abstractions
│   │   │   ├── pagination.tsx             # Page navigation for tables
│   │   │   ├── tabs.tsx                   # @base-ui/react Tabs, pill style
│   │   │   ├── accordion.tsx              # @base-ui/react Accordion
│   │   │   ├── filter-bar.tsx             # search + filter chips row
│   │   │   ├── action-bar.tsx             # sticky bottom action strip
│   │   │   ├── skeleton.tsx               # Loading skeleton with shimmer
│   │   │   ├── progress.tsx               # @base-ui/react Progress
│   │   │   ├── avatar.tsx                 # Image + fallback initials
│   │   │   ├── tooltip.tsx                # @base-ui/react Tooltip
│   │   │   ├── popover.tsx                # @base-ui/react Popover
│   │   │   ├── dialog.tsx                 # @base-ui/react Dialog
│   │   │   ├── sheet.tsx                  # Side drawer (left|right|bottom)
│   │   │   ├── dropdown-menu.tsx          # @base-ui/react Menu
│   │   │   ├── command.tsx                # Command palette (search + actions)
│   │   │   ├── calendar.tsx               # Date picker
│   │   │   ├── date-range-picker.tsx      # Range selection
│   │   │   └── empty-state.tsx            # Icon + title + description + CTA
│   │   │
│   │   ├── shell/                         # Layout layer — frames for page content
│   │   │   ├── app-shell.tsx              # Dashboard: sidebar + header + mobile nav
│   │   │   ├── sidebar.tsx                # Role-aware navigation sidebar
│   │   │   ├── header.tsx                 # Topbar: notifications, user menu
│   │   │   ├── mobile-nav.tsx             # Bottom nav — mobile breakpoint
│   │   │   ├── auth-shell.tsx             # Centered card layout for auth pages
│   │   │   ├── public-shell.tsx           # Marketing: header + footer
│   │   │   ├── footer.tsx                 # Public footer
│   │   │   └── logo.tsx                   # Brand logo lockup
│   │   │
│   │   └── composite/                     # Multi-primitive compositions and providers
│   │       ├── app-providers.tsx          # Ordered provider tree root
│   │       ├── theme-provider.tsx         # next-themes dark mode wrapper
│   │       ├── query-provider.tsx         # TanStack Query client provider
│   │       ├── error-boundary.tsx         # React error boundary with fallback UI
│   │       ├── data-table.tsx             # Table + pagination + filter + sort
│   │       ├── file-uploader.tsx          # Drag-and-drop upload with progress
│   │       └── rich-text-editor.tsx       # Tiptap-based rich text input
│   │
│   ├── features/                          # Domain layer — business logic + page UI
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── login-form.tsx
│   │   │   │   └── register-form.tsx
│   │   │   ├── actions/
│   │   │   │   └── auth.actions.ts        # Server Actions: login, logout, register
│   │   │   └── schemas/
│   │   │       └── auth.schema.ts         # Zod schemas (client + server shared)
│   │   │
│   │   ├── marketing/
│   │   │   └── components/
│   │   │       └── landing-page.tsx
│   │   │
│   │   ├── {{DOMAIN_1}}/                  # Replace with your domain (e.g. "orders")
│   │   │   ├── components/
│   │   │   ├── actions/
│   │   │   ├── hooks/
│   │   │   └── schemas/
│   │   │
│   │   └── settings/
│   │       └── components/
│   │           ├── profile-form.tsx
│   │           └── preferences-form.tsx
│   │
│   ├── hooks/                             # Shared React hooks
│   │   ├── use-debounce.ts
│   │   ├── use-media-query.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-session-storage.ts
│   │   ├── use-clipboard.ts
│   │   ├── use-intersection-observer.ts
│   │   ├── use-countdown.ts
│   │   └── use-event-source.ts            # Server-Sent Events hook
│   │
│   ├── stores/                            # Zustand global state slices
│   │   ├── auth.store.ts                  # user, role, session, logout
│   │   ├── ui.store.ts                    # sidebar, modal, sheet state
│   │   └── notification.store.ts          # unread count, notification list
│   │
│   ├── lib/
│   │   ├── utils.ts                       # cn() = clsx + tailwind-merge
│   │   ├── api-client.ts                  # axios instance + interceptors + retry
│   │   ├── auth.ts                        # NextAuth v5 config, getCurrentUser()
│   │   ├── query-client.ts                # TanStack Query singleton
│   │   └── env.ts                         # Validated env vars via zod (t3-env pattern)
│   │
│   ├── types/                             # Frontend-specific types
│   │   └── index.ts                       # Re-exports from @{{ORG_SLUG}}/types
│   │
│   └── stories/                           # Storybook stories
│       ├── primitives.stories.tsx
│       ├── forms.stories.tsx
│       ├── data-display.stories.tsx
│       ├── overlays.stories.tsx
│       └── shells.stories.tsx
│
├── public/
│   ├── manifest.json                      # PWA manifest
│   ├── sw.js                              # Service worker
│   ├── logo.svg                           # Brand logo
│   ├── icon-192.png
│   ├── icon-512.png
│   └── og-image.png                       # Open Graph default image
│
├── e2e/                                   # Playwright end-to-end tests
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   └── fixtures/
│       └── auth.fixture.ts
│
├── .storybook/
│   ├── main.ts
│   └── preview.ts
│
├── auth.ts                                # NextAuth v5 root config
├── middleware.ts                          # Edge: auth guard + role redirect
├── instrumentation.ts                     # OpenTelemetry registration
├── next.config.ts
├── components.json                        # shadcn config
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

---

### 2.3 Backend Application — apps/api/

```
apps/api/
├── src/
│   ├── index.ts                           # Server entry: Hono app + listen
│   ├── app.ts                             # App factory: middleware + routes
│   │
│   ├── routes/                            # HTTP route handlers (thin layer)
│   │   ├── auth.routes.ts                 # POST /auth/login, /auth/register, /auth/refresh
│   │   ├── users.routes.ts                # CRUD /users
│   │   ├── {{domain}}.routes.ts           # Domain-specific routes
│   │   └── health.routes.ts               # GET /health, /health/ready
│   │
│   ├── controllers/                       # Request parsing + response shaping
│   │   ├── auth.controller.ts
│   │   ├── users.controller.ts
│   │   └── {{domain}}.controller.ts
│   │
│   ├── services/                          # Business logic — pure functions, no HTTP
│   │   ├── auth.service.ts                # login(), register(), refreshToken()
│   │   ├── users.service.ts               # findUser(), updateUser(), deleteUser()
│   │   ├── email.service.ts               # sendVerification(), sendPasswordReset()
│   │   ├── storage.service.ts             # uploadFile(), deleteFile(), getSignedUrl()
│   │   └── {{domain}}.service.ts
│   │
│   ├── middleware/                        # Hono middleware
│   │   ├── auth.middleware.ts             # JWT verify + attach user to context
│   │   ├── rbac.middleware.ts             # Role-based access control
│   │   ├── validate.middleware.ts         # Zod request validation
│   │   ├── rate-limit.middleware.ts       # Redis-backed rate limiting
│   │   ├── cors.middleware.ts             # CORS policy
│   │   └── logger.middleware.ts           # Request logging (pino)
│   │
│   ├── jobs/                              # BullMQ background workers
│   │   ├── queue.ts                       # BullMQ queue definitions
│   │   ├── workers/
│   │   │   ├── email.worker.ts            # Send transactional emails
│   │   │   ├── export.worker.ts           # Generate reports/CSV
│   │   │   └── cleanup.worker.ts          # Periodic data cleanup
│   │   └── scheduler.ts                   # Cron job definitions
│   │
│   ├── lib/
│   │   ├── db.ts                          # Drizzle client singleton
│   │   ├── redis.ts                       # ioredis client singleton
│   │   ├── jwt.ts                         # Sign/verify JWT (jose)
│   │   ├── password.ts                    # Hash/verify password (argon2)
│   │   ├── storage.ts                     # S3 client (AWS SDK v3)
│   │   └── env.ts                         # Validated environment variables
│   │
│   ├── schemas/                           # Zod schemas — request/response contracts
│   │   ├── auth.schema.ts
│   │   ├── users.schema.ts
│   │   └── {{domain}}.schema.ts
│   │
│   └── types/
│       ├── hono.d.ts                      # Hono context type augmentation
│       └── index.ts
│
├── tests/
│   ├── unit/
│   │   └── services/
│   ├── integration/
│   │   └── routes/
│   └── fixtures/
│       └── db.fixture.ts
│
├── tsconfig.json
├── package.json
└── .env.example
```

---

### 2.4 Shared Database Package — packages/db/

```
packages/db/
├── src/
│   ├── index.ts                           # Re-export schema + client + migrations
│   ├── client.ts                          # Drizzle client + pool config
│   ├── schema/                            # Drizzle table definitions
│   │   ├── index.ts                       # Re-export all tables
│   │   ├── users.ts                       # users table
│   │   ├── sessions.ts                    # sessions table
│   │   ├── audit-logs.ts                  # audit_logs table
│   │   └── {{domain}}.ts                  # domain-specific tables
│   ├── migrations/                        # Auto-generated by drizzle-kit
│   │   └── 0001_init.sql
│   └── seed/
│       ├── index.ts                       # Seed orchestrator
│       └── {{domain}}.seed.ts
├── drizzle.config.ts
├── tsconfig.json
└── package.json                           # name: "@{{ORG_SLUG}}/db"
```

---

### 2.5 Shared UI Package — packages/ui/

```
packages/ui/
├── src/
│   ├── index.ts                           # Re-export all components
│   ├── components/                        # Same structure as apps/web/components/ui/
│   │   └── (all primitive components)
│   └── styles/
│       └── tokens.css                     # Design token CSS
├── tsconfig.json
└── package.json                           # name: "@{{ORG_SLUG}}/ui"
```

---

## SECTION 3 — DEPENDENCY MANIFEST

### 3.1 Frontend — apps/web

#### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `16.2.3` | App Router, RSC, PPR, Server Actions, Edge Runtime |
| `react` | `19.2.4` | useOptimistic, use(), React Compiler, Form Actions |
| `react-dom` | `19.2.4` | DOM renderer |
| `@base-ui/react` | `^1.3.0` | Accessible headless primitives (Dialog, Select, Tabs, etc.) |
| `shadcn` | `^4.2.0` | Component registry, style: base-nova |
| `tailwind-merge` | `^3.5.0` | Conflict-free Tailwind class merge |
| `clsx` | `^2.1.1` | Conditional className composition |
| `class-variance-authority` | `^0.7.1` | Type-safe component variant system |
| `tw-animate-css` | `^1.4.0` | CSS keyframe animations for Tailwind v4 |
| `lucide-react` | `^1.8.0` | SVG icon library (1400+ icons) |
| `next-themes` | `^0.4.6` | SSR-safe dark mode |
| `sonner` | `^2.0.7` | Non-blocking toast notifications |
| `react-hook-form` | `^7.72.1` | Zero-rerender form state management |
| `@hookform/resolvers` | `^5.2.2` | RHF ↔ Zod bridge |
| `zod` | `^4.3.6` | Schema validation (14× faster than v3) |
| `next-auth` | `beta` | Auth.js v5: SSO, JWT, OAuth |
| `@auth/core` | `latest` | Auth.js core |
| `@tanstack/react-query` | `^5.80.0` | Client-side cache + background sync |
| `@tanstack/react-query-devtools` | `^5.80.0` | Query inspector (dev only) |
| `zustand` | `^5.0.0` | Lightweight global state management |
| `axios` | `^1.9.0` | HTTP client with interceptors |
| `@vercel/analytics` | `^1.5.0` | Real user metrics |
| `@vercel/speed-insights` | `^1.2.0` | Core Web Vitals dashboard |
| `@vercel/flags` | `^3.0.0` | Feature flag evaluation at edge |
| `@vercel/otel` | `^1.10.0` | OpenTelemetry auto-instrumentation |
| `@t3-oss/env-nextjs` | `^0.12.0` | Type-safe environment variables |

#### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5` | Type checker |
| `@types/node` | `^20` | Node.js type definitions |
| `@types/react` | `^19` | React type definitions |
| `tailwindcss` | `^4` | CSS engine |
| `@tailwindcss/postcss` | `^4` | PostCSS plugin |
| `eslint` | `^9` | Linter |
| `eslint-config-next` | `16.2.3` | Next.js ESLint rules |
| `storybook` | `^10.3.5` | Component development environment |
| `@storybook/nextjs-vite` | `^10.3.5` | Storybook on Vite (fast) |
| `@storybook/addon-vitest` | `^10.3.5` | Run tests in Storybook UI |
| `@storybook/addon-a11y` | `^10.3.5` | Axe accessibility audit |
| `@storybook/addon-docs` | `^10.3.5` | Auto-generated component docs |
| `@chromatic-com/storybook` | `^5.1.1` | Visual regression via Chromatic |
| `vite` | `^8.0.8` | Bundler for Storybook + Vitest |
| `vitest` | `^4.1.4` | Unit + component test runner |
| `@vitest/browser-playwright` | `^4.1.4` | Real browser testing |
| `@vitest/coverage-v8` | `^4.1.4` | V8 native coverage |
| `@testing-library/react` | `^16.3.0` | React component testing utilities |
| `@testing-library/user-event` | `^14.6.0` | User interaction simulation |
| `playwright` | `^1.59.1` | E2E browser automation |
| `@playwright/test` | `^1.59.1` | Playwright test runner |
| `@sentry/nextjs` | `^9.0.0` | Error tracking + session replay |

---

### 3.2 Backend — apps/api

#### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | `^4.7.0` | Ultra-fast web framework (Edge-native) |
| `@hono/node-server` | `^1.14.0` | Node.js adapter for Hono |
| `@hono/zod-validator` | `^0.5.0` | Zod request validation middleware |
| `zod` | `^4.3.6` | Request/response schema validation |
| `drizzle-orm` | `^0.43.0` | Type-safe SQL ORM |
| `postgres` | `^3.4.5` | PostgreSQL driver (pure JS) |
| `ioredis` | `^5.6.1` | Redis client (sessions, cache, pub/sub) |
| `bullmq` | `^5.53.0` | Redis-backed job queue |
| `jose` | `^5.10.0` | JWT sign/verify (Web Crypto API) |
| `argon2` | `^0.43.0` | Password hashing (Argon2id) |
| `@aws-sdk/client-s3` | `^3.820.0` | S3 file storage |
| `@aws-sdk/s3-request-presigner` | `^3.820.0` | Presigned URLs for uploads |
| `nodemailer` | `^6.10.1` | SMTP email sending |
| `pino` | `^9.7.0` | Structured logging |
| `pino-pretty` | `^13.0.0` | Human-readable log formatting |

#### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5` | Type checker |
| `tsx` | `^4.19.4` | TypeScript execution for dev |
| `drizzle-kit` | `^0.31.0` | Migration generator + Drizzle Studio |
| `vitest` | `^4.1.4` | Test runner |
| `@types/nodemailer` | `^6.4.17` | Nodemailer types |
| `supertest` | `^7.1.0` | HTTP assertion for integration tests |

---

### 3.3 Infrastructure Tools

| Tool | Version | Purpose |
|------|---------|---------|
| `turbo` | `^2.5.4` | Monorepo task runner + build cache |
| `docker` | `27+` | Container runtime |
| `docker-compose` | `v2` | Local development orchestration |
| `postgresql` | `16` | Primary relational database |
| `redis` | `7` | Cache, session store, job queue |
| Node.js | `22 LTS` | JavaScript runtime |
| `pnpm` or `npm` | latest | Package manager |

---

## SECTION 4 — CONFIGURATION FILES

### 4.1 turbo.json (workspace root)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "storybook-static/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:generate": {
      "inputs": ["src/schema/**"],
      "outputs": ["src/migrations/**"]
    }
  }
}
```

### 4.2 docker-compose.yml (local development)

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: {{PROJECT_SLUG}}_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: tooling/docker/Dockerfile.api
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgresql://dev:dev@postgres:5432/{{PROJECT_SLUG}}_dev
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api/src:/app/apps/api/src   # hot reload

volumes:
  postgres_data:
  redis_data:
```

### 4.3 next.config.ts

```typescript
import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,                     // Partial Prerendering
    viewTransition: true,          // Native page transition API
    reactCompiler: true,           // Auto-memoization (React Compiler)
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "{{STORAGE_BUCKET_HOSTNAME}}" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  logging: {
    fetches: { fullUrl: process.env.NODE_ENV === "development" },
  },
}

export default nextConfig
```

### 4.4 tsconfig.json (strict mode)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.5 drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit"
import { env } from "./src/lib/env"

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
```

### 4.6 .env.example (complete)

```bash
# ─────────────────────────────────────────────
# APPLICATION
# ─────────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="{{PROJECT_NAME}}"
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1

# ─────────────────────────────────────────────
# DATABASE — PostgreSQL
# ─────────────────────────────────────────────
DATABASE_URL=postgresql://dev:dev@localhost:5432/{{PROJECT_SLUG}}_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ─────────────────────────────────────────────
# CACHE — Redis
# ─────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─────────────────────────────────────────────
# AUTHENTICATION — NextAuth v5
# ─────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                          # openssl rand -base64 32
JWT_SECRET=                               # openssl rand -base64 32
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ─────────────────────────────────────────────
# OAUTH PROVIDERS
# ─────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ─────────────────────────────────────────────
# STORAGE — S3 / R2 / MinIO
# ─────────────────────────────────────────────
STORAGE_ENDPOINT=                         # e.g. https://s3.amazonaws.com
STORAGE_REGION=ap-southeast-1
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_BUCKET=
STORAGE_PUBLIC_URL=                       # CDN URL for public assets

# ─────────────────────────────────────────────
# EMAIL — SMTP
# ─────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="{{PROJECT_NAME}} <no-reply@{{PRODUCTION_DOMAIN}}>"

# ─────────────────────────────────────────────
# ERROR TRACKING — Sentry
# ─────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# ─────────────────────────────────────────────
# VISUAL REGRESSION — Chromatic
# ─────────────────────────────────────────────
CHROMATIC_PROJECT_TOKEN=

# ─────────────────────────────────────────────
# FEATURE FLAGS — Vercel
# ─────────────────────────────────────────────
FLAGS_SECRET=                             # openssl rand -base64 32
EDGE_CONFIG=

# ─────────────────────────────────────────────
# OBSERVABILITY — OpenTelemetry
# ─────────────────────────────────────────────
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME={{PROJECT_SLUG}}-web
OTEL_SERVICE_VERSION=0.1.0

# ─────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=

# ─────────────────────────────────────────────
# TURBOREPO REMOTE CACHE
# ─────────────────────────────────────────────
TURBO_TOKEN=
TURBO_TEAM=
```

---

## SECTION 5 — DATABASE SCHEMA CONTRACTS

### 5.1 Base Tables (Required in All Projects)

```typescript
// packages/db/src/schema/users.ts
import { pgTable, uuid, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core"

export const roleEnum = pgEnum("role", [
  "{{ROLE_1_ID}}", "{{ROLE_2_ID}}", "{{ROLE_3_ID}}"
])

export const users = pgTable("users", {
  id:              uuid("id").primaryKey().defaultRandom(),
  email:           text("email").notNull().unique(),
  emailVerified:   timestamp("email_verified"),
  name:            text("name").notNull(),
  avatarUrl:       text("avatar_url"),
  role:            roleEnum("role").notNull().default("{{ROLE_1_ID}}"),
  isActive:        boolean("is_active").notNull().default(true),
  passwordHash:    text("password_hash"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
})

// packages/db/src/schema/sessions.ts
export const sessions = pgTable("sessions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:        text("token").notNull().unique(),
  expiresAt:    timestamp("expires_at").notNull(),
  ipAddress:    text("ip_address"),
  userAgent:    text("user_agent"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
})

// packages/db/src/schema/audit-logs.ts
export const auditLogs = pgTable("audit_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").references(() => users.id),
  action:     text("action").notNull(),             // e.g. "user.login", "resource.create"
  entityType: text("entity_type"),                  # e.g. "user", "order"
  entityId:   text("entity_id"),
  metadata:   text("metadata"),                     # JSON string
  ipAddress:  text("ip_address"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
})
```

### 5.2 Database Conventions

```
Naming:
  Tables:       snake_case plural           e.g. audit_logs, order_items
  Columns:      snake_case                  e.g. created_at, user_id
  Enums:        snake_case singular         e.g. role, status
  Indexes:      {table}_{columns}_idx       e.g. users_email_idx
  FK:           {table}_{ref_table}_id_fk   e.g. sessions_users_id_fk

Primary Keys:
  All tables use UUID v4 (defaultRandom()).
  Never use auto-increment integer as primary key.

Timestamps:
  Every table MUST have created_at TIMESTAMP NOT NULL DEFAULT NOW().
  Tables with mutable records MUST have updated_at (trigger-maintained).

Soft Delete:
  Prefer is_active BOOLEAN over physical DELETE for user-facing records.
  Audit logs MUST never be deleted.

Migrations:
  Generated by drizzle-kit generate
  Applied by drizzle-kit migrate
  Never hand-edit generated migration files.
  Every migration must be backward-compatible (no destructive changes in one step).
```

---

## SECTION 6 — API CONTRACT SPECIFICATION

### 6.1 HTTP API Conventions

```
Base URL:         /api/v1
Authentication:   Bearer {jwt_access_token} in Authorization header
Content-Type:     application/json
Accept:           application/json

Status Codes:
  200 OK                 Successful GET, PATCH, PUT
  201 Created            Successful POST (resource created)
  204 No Content         Successful DELETE
  400 Bad Request        Validation error — include Zod errors in body
  401 Unauthorized       Missing or invalid JWT
  403 Forbidden          Valid JWT but insufficient role
  404 Not Found          Resource does not exist
  409 Conflict           Uniqueness violation (e.g. duplicate email)
  422 Unprocessable      Business logic error (not a validation error)
  429 Too Many Requests  Rate limit exceeded — include Retry-After header
  500 Internal Server    Never expose stack trace to client

Response Envelope:
  Success:  { "data": T, "meta"?: PaginationMeta }
  Error:    { "error": { "code": string, "message": string, "details"?: unknown } }

Pagination:
  Query params: ?page=1&limit=20&sort=created_at&order=desc
  Meta:         { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
```

### 6.2 Authentication Flow

```
1. POST /api/v1/auth/login
   Body: { email, password }
   Response: { data: { accessToken, refreshToken, user } }
   - accessToken: JWT, expires 15m
   - refreshToken: opaque token, stored in Redis, expires 30d

2. POST /api/v1/auth/refresh
   Body: { refreshToken }
   Response: { data: { accessToken, refreshToken } }
   - Rotates refresh token (old one invalidated in Redis)

3. POST /api/v1/auth/logout
   Header: Authorization: Bearer {accessToken}
   Body: { refreshToken }
   Response: 204 No Content
   - Invalidates refresh token in Redis

4. GET /api/v1/auth/me
   Header: Authorization: Bearer {accessToken}
   Response: { data: User }
```

---

## SECTION 7 — DESIGN SYSTEM SPECIFICATION

### 7.1 Token Architecture (4 Tiers)

```
TIER 0 — Primitive Tokens (raw values)
  Color:   hex values — no semantic meaning
  Number:  rem, ms, unitless — no semantic meaning

TIER 1 — Semantic Tokens (globals.css :root and .dark)
  Maps primitives to named intent:
  --background, --foreground, --surface-*, --primary, --muted, etc.
  Light defaults in :root. Dark overrides in .dark.

TIER 2 — Role Preset Tokens ([data-role-theme="{{ROLE_ID}}"])
  5 variables overridden per role:
  --role-accent          Primary action color for this role
  --role-accent-soft     Tinted background (10-12% opacity)
  --role-accent-strong   Pressed/hover deeper shade
  --role-sidebar         Sidebar background tint
  --role-badge           Badge chip background

TIER 3 — Tailwind Utility Bridge (@theme inline in globals.css)
  Maps CSS custom properties to utility classes:
  --color-role-accent  →  text-role-accent, bg-role-accent, border-role-accent
  --shadow-card        →  shadow-(--shadow-card)
  --z-header           →  z-(--z-header)
  All tokens must be accessible as utility classes — never use arbitrary values.
```

### 7.2 Surface Hierarchy (Replace Borders)

```
Level 0 — page background:         --background
Level 1 — subtle section:          --surface-container-low
Level 2 — card default:            --surface-container
Level 3 — elevated card:           --surface-container-lowest   (#ffffff)
Level 4 — floating (glass):        backdrop-blur + bg-white/80

Rule: Every element must sit on a surface one level higher than its parent.
Rule: Use surface level changes for grouping — never 1px borders.
```

### 7.3 Shadow Scale

```css
--shadow-soft:   0 1px 2px rgb(0 0 0 / 0.035);     /* subtle depth */
--shadow-card:   0 10px 24px rgb(0 0 0 / 0.04);     /* card elevation */
--shadow-float:  0 16px 36px rgb(0 0 0 / 0.07);     /* modal, dropdown */
```

### 7.4 Motion Scale

```css
--motion-snappy: 160ms cubic-bezier(0.2, 0.8, 0.2, 1);   /* micro-interactions */
--motion-smooth: 320ms cubic-bezier(0.2, 0.8, 0.2, 1);   /* page transitions */
```

### 7.5 Z-Index Scale

```css
--z-base:    0;
--z-raise:   10;
--z-sidebar: 30;
--z-header:  40;
--z-sheet:   50;
--z-dialog:  60;
--z-toast:   70;
--z-tooltip: 80;
```

### 7.6 Design Principles (Non-Negotiable)

```
1. NO 1PX BORDERS FOR GROUPING
   Use surface elevation shifts. Borders add cognitive weight.
   Exception: input fields, table rows (outline-soft: rgb opacity 0.08).

2. AMBIENT SHADOWS ONLY
   shadow-soft, shadow-card, shadow-float — never outline or glow effects.
   Shadows communicate z-elevation, not focus state.

3. ROLE ACCENT IS AN ACCENT — NOT A BACKGROUND
   --role-accent for interactive elements, active states, icon fills.
   Never fill a full section background with role-accent.

4. GLASSMORPHISM — FLOATING ELEMENTS ONLY
   app-glass (backdrop-blur + semi-transparent bg) only for:
   dropdowns, tooltips, dialogs, sheets, command palettes.
   Not for cards sitting in normal document flow.

5. NO COMPONENT FORKING PER ROLE
   Card, Sidebar, Header, Table, FormField are global primitives.
   Role customizes visual preset via data-role-theme attribute only.
   Never create RoleNameCard, RoleNameButton, RoleNameTable.

6. TAILWIND v4 CLASS SYNTAX
   Use canonical utility classes — never arbitrary CSS variable references.
   ✓ text-role-accent          ✗ text-[var(--role-accent)]
   ✓ shadow-(--shadow-card)    ✗ shadow-[var(--shadow-card)]
   ✓ z-(--z-header)            ✗ z-[var(--z-header)]
```

---

## SECTION 8 — RENDERING ARCHITECTURE

### 8.1 RSC Decision Tree

```
Is the component interactive (onClick, useState, browser API)?
  YES → "use client" — render in browser
  NO  →
    Does it fetch data?
      YES → async Server Component — fetch on server, zero client JS
      NO  → Server Component (static) — rendered at build time (PPR-eligible)
```

### 8.2 Partial Prerendering (PPR) Pattern

```tsx
// app/(app)/dashboard/page.tsx
import { Suspense } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { Skeleton } from "@/components/ui/skeleton"

// Static: AppShell is built at deploy time
// Dynamic: Suspense slots stream at request time
export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <StatsSection />           {/* async RSC — streams */}
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RecentActivityTable />    {/* async RSC — streams */}
      </Suspense>
    </AppShell>
  )
}
```

### 8.3 Server Action Pattern

```typescript
// src/features/{{domain}}/actions/{{domain}}.actions.ts
"use server"

import { z } from "zod"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { db } from "@{{ORG_SLUG}}/db"

const createSchema = z.object({ ... })

export async function createResource(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error("UNAUTHORIZED")

  const input = createSchema.parse(Object.fromEntries(formData))
  const result = await db.insert(table).values({ ...input, userId: session.user.id }).returning()

  revalidatePath("/dashboard")
  return { success: true, data: result[0] }
}
```

### 8.4 Optimistic UI Pattern

```typescript
"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

export function ResourceForm({ resourceId }: { resourceId: string }) {
  const [optimistic, setOptimistic] = useOptimistic(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setOptimistic(true)
      const result = await createResource(formData)
      if (!result.success) toast.error("Action failed. Please try again.")
      else toast.success("Saved successfully.")
    })
  }

  return <form action={handleSubmit}>...</form>
}
```

---

## SECTION 9 — AUTHENTICATION & AUTHORIZATION

### 9.1 Auth Architecture

```
Session Strategy: JWT
  Access Token:   15 min expiry, stored in memory (not localStorage)
  Refresh Token:  30 day expiry, stored in Redis, rotated on use
  Cookie:         httpOnly, secure, sameSite: lax

Role Stored In:
  JWT payload → req.auth.user.role (available in middleware + RSC)

OAuth Providers:
  Google (optional), GitHub (optional), Custom Credentials

Route Protection:
  middleware.ts intercepts all requests
  Role mismatch → 302 redirect to /unauthorized
  No session → 302 redirect to /login
```

### 9.2 middleware.ts Contract

```typescript
import NextAuth from "next-auth"
import { authConfig } from "@/auth"
import { NextResponse } from "next/server"
import type { AppRole } from "@{{ORG_SLUG}}/types"

const { auth } = NextAuth(authConfig)

// Define role → allowed paths mapping
const ROLE_PATHS: Record<string, AppRole[]> = {
  "/dashboard":          ["{{ROLE_1_ID}}"],
  "/{{ROLE_2_ID}}":      ["{{ROLE_2_ID}}"],
  "/admin":              ["{{ROLE_3_ID}}"],
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const role = req.auth?.user?.role as AppRole | undefined

  for (const [route, allowed] of Object.entries(ROLE_PATHS)) {
    if (!pathname.startsWith(route)) continue
    if (!req.auth) return NextResponse.redirect(new URL("/login", req.url))
    if (!role || !allowed.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
  }
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
}
```

---

## SECTION 10 — REAL-TIME ARCHITECTURE

### 10.1 Server-Sent Events (recommended for read-only push)

```typescript
// src/app/api/stream/route.ts
export const runtime = "edge"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: "connected" })

      const interval = setInterval(async () => {
        const update = await getRealtimeUpdate(userId)
        send({ type: "update", payload: update })
      }, 10_000)

      req.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
```

### 10.2 Redis Pub/Sub (for multi-instance real-time)

```typescript
// When multiple API server instances are running,
// use Redis pub/sub so any instance can broadcast to any connected client.
// Publisher (triggered by a user action):
await redis.publish("channel:{{domain}}", JSON.stringify({ type: "update", payload }))

// Subscriber (SSE handler — one per connection):
const sub = redis.duplicate()
await sub.subscribe("channel:{{domain}}")
sub.on("message", (_, message) => send(JSON.parse(message)))
req.signal.addEventListener("abort", () => sub.disconnect())
```

---

## SECTION 11 — BACKGROUND JOBS

### 11.1 BullMQ Queue Definitions

```typescript
// apps/api/src/jobs/queue.ts
import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

const connection = { connection: redis }

export const emailQueue = new Queue("email", connection)
export const exportQueue = new Queue("export", connection)
export const cleanupQueue = new Queue("cleanup", connection)

// apps/api/src/jobs/workers/email.worker.ts
import { Worker } from "bullmq"

new Worker("email", async (job) => {
  const { to, template, variables } = job.data
  await emailService.send({ to, template, variables })
}, { connection: redis, concurrency: 5 })
```

### 11.2 Scheduled Jobs (Cron via BullMQ)

```typescript
// apps/api/src/jobs/scheduler.ts
import { QueueScheduler } from "bullmq"

// Daily cleanup at 2am
cleanupQueue.add("daily-cleanup", {}, {
  repeat: { pattern: "0 2 * * *", tz: "{{DEFAULT_TIMEZONE}}" },
})
```

---

## SECTION 12 — OBSERVABILITY

### 12.1 Structured Logging (pino)

```typescript
// apps/api/src/lib/logger.ts
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: { service: process.env.OTEL_SERVICE_NAME },
})

// Usage in request handlers:
// logger.info({ userId, action }, "User logged in")
// logger.error({ err, requestId }, "Failed to process job")
```

### 12.2 OpenTelemetry (frontend)

```typescript
// apps/web/instrumentation.ts
import { registerOTel } from "@vercel/otel"
export function register() {
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "web" })
}
```

### 12.3 Sentry (frontend + backend)

```typescript
// apps/web/sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [Sentry.replayIntegration()],
})

// apps/api/src/lib/sentry.ts
import * as Sentry from "@sentry/node"
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

### 12.4 Performance Budget

```
Core Web Vitals (enforced by Lighthouse CI):
  LCP (Largest Contentful Paint)  ≤ 2.5s
  FID (First Input Delay)         ≤ 100ms
  CLS (Cumulative Layout Shift)   ≤ 0.1
  FCP (First Contentful Paint)    ≤ 1.8s
  TTFB (Time to First Byte)       ≤ 800ms

Lighthouse Scores (minimum):
  Performance       ≥ 90
  Accessibility     ≥ 95
  Best Practices    ≥ 95
  SEO               ≥ 90

Bundle Size Budget (gzip):
  Initial JS        ≤ 100 KB
  Per-route JS      ≤ 50 KB
  Total CSS         ≤ 30 KB
```

---

## SECTION 13 — CI/CD PIPELINE

### 13.1 .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  quality:
    name: Lint · Types · Test · Build
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: {{PROJECT_SLUG}}_test
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/{{PROJECT_SLUG}}_test

      - name: Lint
        run: npx turbo lint

      - name: Type check
        run: npx turbo typecheck

      - name: Unit + integration tests
        run: npx turbo test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/{{PROJECT_SLUG}}_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Build all apps
        run: npx turbo build
        env:
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx turbo test:e2e
        env:
          BASE_URL: http://localhost:3000

  lighthouse:
    name: Lighthouse CI
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci && npx turbo build
      - run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
```

### 13.2 .github/workflows/chromatic.yml

```yaml
name: Chromatic

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run build-storybook --filter=web
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          storybookBuildDir: apps/web/storybook-static
          exitZeroOnChanges: true
          autoAcceptChanges: main
```

---

## SECTION 14 — PWA SPECIFICATION

### 14.1 public/manifest.json

```json
{
  "name": "{{PROJECT_NAME}}",
  "short_name": "{{PROJECT_SLUG}}",
  "description": "{{PROJECT_DESCRIPTION}}",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#f8f9fa",
  "theme_color": "{{BRAND_PRIMARY_HEX}}",
  "lang": "{{DEFAULT_LOCALE}}",
  "dir": "ltr",
  "categories": ["productivity"],
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## SECTION 15 — ACCESSIBILITY CONTRACT

```
Standard: WCAG 2.2 Level AA (mandatory)

Color Contrast Minimums:
  Normal text (< 18pt / < 14pt bold)  ≥ 4.5:1
  Large text (≥ 18pt / ≥ 14pt bold)   ≥ 3.0:1
  UI components and graphical objects  ≥ 3.0:1
  All role accent colors must pass against white background.

Keyboard Navigation:
  All interactive elements reachable and operable via keyboard.
  Logical focus order: left-to-right, top-to-bottom.
  Visible focus ring on all interactive elements (ring utility class).
  Escape key closes dialogs, sheets, dropdowns.
  Arrow keys navigate menus, tabs, and list items.

Screen Reader Requirements:
  All non-decorative images have descriptive alt text.
  All icon-only buttons have aria-label.
  Dynamic content changes use aria-live="polite".
  Form inputs linked to labels via htmlFor / aria-labelledby.
  Error messages linked to inputs via aria-describedby.
  Loading states announced via aria-busy="true".

Enforcement:
  @storybook/addon-a11y — zero axe violations per story (CI-enforced).
  Lighthouse accessibility score ≥ 95 (CI-enforced).
  Manual keyboard navigation test required before every production release.
```

---

## SECTION 16 — COMPONENT ARCHITECTURE RULES

### 16.1 Classification Contract

```
PRIMITIVE (components/ui/)
  ✓ Accepts visual + content props only
  ✓ No business logic, no API calls, no store access
  ✓ Fully functional in Storybook isolation
  ✓ CVA required for any component with 2+ visual states
  ✗ Never accesses auth session
  ✗ Never imports from features/

SHELL (components/shell/)
  ✓ Composes primitives into layout frames
  ✓ Accepts navigation data and role as props
  ✓ Sets data-role-theme on wrapper element
  ✗ Never calls APIs
  ✗ Never contains business logic

COMPOSITE (components/composite/)
  ✓ Provider wrappers and structural compositions
  ✓ Multi-primitive patterns reused across features
  ✗ No page-specific logic

FEATURE (features/**/components/)
  ✓ Consumes primitives, shells, composites
  ✓ May call Server Actions, use hooks, access stores
  ✓ One feature component = one page or major section
  ✗ Never creates new primitives internally
  ✗ Never imports from another feature domain directly
```

### 16.2 Server vs Client Rule

```
DEFAULT: Server Component — no directive needed.
  Fetches data with async/await.
  Renders static markup.
  Passes data to client components as props.

"use client" ONLY when:
  useState, useEffect, useReducer, useRef, useContext
  Event handlers: onClick, onChange, onSubmit, onKeyDown
  Browser APIs: window, document, navigator, localStorage
  Zustand store access
  TanStack Query (useQuery, useMutation)
  react-hook-form

NEVER:
  "use client" on page-level components (page.tsx)
  async functions in client components (use Server Actions instead)
  fetch() calls inside client components (use TanStack Query)
  "use server" and "use client" in the same file
```

---

## SECTION 17 — ANTI-PATTERNS (PROHIBITED)

```
STYLING
  ✗  text-[var(--role-accent)]         →  text-role-accent
  ✗  Hardcoded hex in className        →  Use semantic token class
  ✗  style={{ color: "var(...)" }}     →  Use Tailwind utility
  ✗  1px solid border for grouping     →  Use surface elevation
  ✗  !important overrides              →  Fix specificity instead
  ✗  @apply in feature components      →  Use Tailwind utilities inline

COMPONENTS
  ✗  Fork primitive per role           →  Use data-role-theme
  ✗  Business logic in primitives      →  Move to feature or action
  ✗  API calls in shell/ui/composite   →  Move to RSC or hooks
  ✗  New primitives inside features/   →  Add to components/ui/
  ✗  Role string literals outside      →  Import AppRole type
     design-system/roles.ts

DATA & STATE
  ✗  useEffect for data fetching       →  Use RSC or TanStack Query
  ✗  fetch() in client components      →  Use TanStack Query hook
  ✗  Global state in React Context     →  Use Zustand
  ✗  Sensitive data in localStorage    →  Use httpOnly cookies
  ✗  Sequential awaits for parallel    →  Use Promise.all()
     data fetching

TYPESCRIPT
  ✗  value as SomeType (unsafe cast)   →  Use type guard function
  ✗  any type                          →  Use proper type or unknown
  ✗  value! (non-null assertion)       →  Use null check or optional chain
  ✗  @ts-ignore                        →  Fix the type error

DATABASE
  ✗  Raw SQL strings                   →  Use Drizzle query builder
  ✗  N+1 queries                       →  Use joins or batch fetching
  ✗  Hand-editing migration files      →  Regenerate with drizzle-kit
  ✗  Storing passwords in plaintext    →  Always argon2id hash
  ✗  Integer auto-increment PKs        →  Use UUID v4

SECURITY
  ✗  Exposing stack traces to client   →  Log server-side, return error code
  ✗  SQL/command string interpolation  →  Use parameterized queries
  ✗  Unvalidated user input in API     →  Always validate with Zod
  ✗  JWT in localStorage               →  Use httpOnly cookie
  ✗  Hardcoded secrets in source       →  Always use environment variables
```

---

## SECTION 18 — SECURITY REQUIREMENTS

```
Authentication:
  Passwords: argon2id hash, minimum work factor 3
  JWT access tokens: 15 min expiry, HS256 or RS256
  Refresh tokens: opaque, stored in Redis with TTL, rotated on use
  Sessions: httpOnly, Secure, SameSite=Lax cookies only

API Security:
  All endpoints require authentication except: /health, /auth/login, /auth/register
  Rate limiting: 100 req/min per IP on public endpoints, 1000 req/min authenticated
  CORS: whitelist NEXT_PUBLIC_APP_URL only — no wildcard
  Helmet headers: X-Frame-Options, Content-Security-Policy, HSTS
  Input validation: Zod schema on every request body, query param, path param

Infrastructure:
  All environment secrets in CI secrets store — never in source code
  Database accessible only from API service — not from public internet
  Redis accessible only from API service — not from public internet
  TLS 1.2+ required for all external connections
  Dependency audit: npm audit on every CI run, block on high severity
```

---

## SECTION 19 — SETUP SEQUENCE

> Execute in this exact order. Do not skip steps. Do not reorder.

### Phase 0 — Prerequisites

```bash
node --version    # must be >= 22.0.0
npm --version     # must be >= 10.0.0
docker --version  # must be >= 27.0.0
```

### Phase 1 — Monorepo Initialization

```bash
npx create-turbo@latest {{PROJECT_SLUG}} --package-manager npm
cd {{PROJECT_SLUG}}
```

### Phase 2 — Frontend App

```bash
cd apps
npx create-next-app@16.2.3 web \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack
cd web
```

### Phase 3 — Frontend Dependencies

```bash
# Production
npm install \
  @base-ui/react shadcn tw-animate-css \
  class-variance-authority tailwind-merge clsx \
  lucide-react next-themes sonner \
  react-hook-form @hookform/resolvers zod \
  next-auth@beta @auth/core \
  @tanstack/react-query @tanstack/react-query-devtools \
  zustand axios \
  @vercel/analytics @vercel/speed-insights @vercel/flags @vercel/otel \
  @t3-oss/env-nextjs

# Development
npm install -D \
  storybook @storybook/nextjs-vite \
  @storybook/addon-vitest @storybook/addon-a11y \
  @storybook/addon-docs @chromatic-com/storybook \
  vite vitest @vitest/browser-playwright @vitest/coverage-v8 \
  @testing-library/react @testing-library/user-event \
  playwright @playwright/test \
  @sentry/nextjs
```

### Phase 4 — Backend App

```bash
cd ../../apps
mkdir api && cd api
npm init -y
npm install \
  hono @hono/node-server @hono/zod-validator zod \
  drizzle-orm postgres ioredis bullmq \
  jose argon2 \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  nodemailer pino pino-pretty

npm install -D typescript tsx drizzle-kit vitest supertest
```

### Phase 5 — Shared Packages

```bash
cd ../../packages
mkdir -p ui/src db/src types/src utils/src
# Initialize each package.json with correct name: @{{ORG_SLUG}}/ui etc.
```

### Phase 6 — Infrastructure

```bash
# Copy docker-compose.yml to tooling/docker/
# Start local services
docker compose -f tooling/docker/docker-compose.yml up -d

# Run database migrations
npm run db:generate
npm run db:migrate
```

### Phase 7 — File Creation Order

```
1.  packages/db/src/schema/              — database table definitions
2.  packages/db/src/client.ts            — Drizzle client
3.  apps/web/src/app/globals.css         — design token source of truth
4.  apps/web/src/design-system/roles.ts  — role definitions
5.  apps/web/src/lib/utils.ts            — cn() utility
6.  apps/web/src/lib/env.ts              — validated environment variables
7.  apps/web/src/components/ui/*.tsx     — all primitive components
8.  apps/web/src/components/shell/*.tsx  — all shell components
9.  apps/web/src/components/composite/  — providers
10. apps/web/auth.ts                     — NextAuth config
11. apps/web/middleware.ts               — route protection
12. apps/web/instrumentation.ts          — OpenTelemetry
13. apps/web/src/stores/*.ts             — Zustand stores
14. apps/web/src/lib/api-client.ts       — axios instance
15. apps/web/src/lib/query-client.ts     — TanStack Query
16. apps/web/src/hooks/*.ts              — shared hooks
17. apps/web/src/app/layout.tsx          — root layout (all providers wired)
18. apps/web/src/features/**             — feature components + actions
19. apps/web/src/app/**/page.tsx         — route pages
20. apps/api/src/**                      — Hono routes, services, middleware
21. apps/web/src/stories/**              — Storybook stories
22. apps/web/e2e/**                      — Playwright tests
23. .github/workflows/**                 — CI/CD pipelines
24. public/manifest.json                 — PWA manifest
```

---

## SECTION 20 — QUALITY GATES (MERGE REQUIREMENTS)

All must pass before merging to `main`:

```
CODE QUALITY
  [ ] TypeScript: 0 errors  (npx tsc --noEmit)
  [ ] ESLint: 0 errors, 0 warnings
  [ ] No patterns from Section 17 (Anti-Patterns)
  [ ] npm audit: 0 high or critical severity vulnerabilities

TESTING
  [ ] Unit test line coverage ≥ 70%
  [ ] Unit test function coverage ≥ 70%
  [ ] All E2E tests pass on Chromium and Mobile Chrome
  [ ] Storybook: 0 axe accessibility violations

VISUAL
  [ ] Chromatic: all visual changes reviewed and approved
  [ ] All role themes verified in Storybook

PERFORMANCE
  [ ] Lighthouse Performance ≥ 90
  [ ] Lighthouse Accessibility ≥ 95
  [ ] Lighthouse Best Practices ≥ 95
  [ ] Lighthouse SEO ≥ 90
  [ ] LCP ≤ 2.5s   CLS ≤ 0.1   FCP ≤ 1.8s

BUILD
  [ ] next build: 0 errors, 0 warnings
  [ ] api build: 0 TypeScript errors
  [ ] No bundle size regression > 10%

SECURITY
  [ ] No hardcoded secrets (git-secrets scan)
  [ ] All new API endpoints have authentication + Zod validation
  [ ] No unsafe type assertions or any types introduced
```

---

## SECTION 21 — GLOSSARY

| Term | Definition |
|------|------------|
| RSC | React Server Component — rendered on server, no JavaScript sent to client |
| PPR | Partial Prerendering — static shell pre-built at deploy, dynamic slots streamed at request time |
| SSE | Server-Sent Events — unidirectional push from server to client over HTTP |
| CVA | class-variance-authority — type-safe component variant definition and resolution |
| OTel | OpenTelemetry — vendor-neutral observability standard for traces, metrics, logs |
| BFF | Backend For Frontend — thin API layer in Next.js that proxies to internal services |
| RBAC | Role-Based Access Control — permissions granted based on user role |
| RHF | react-hook-form — performant form state manager, zero re-render per keystroke |
| TQ | TanStack Query — async state management: cache, background refetch, mutations |
| ORM | Object-Relational Mapper — Drizzle in this system, type-safe SQL abstraction |
| Tier 0–3 | Design token layers: primitive values → semantic names → role overrides → Tailwind utilities |
| Shell | Layout wrapper component (AppShell, AuthShell, PublicShell) |
| Primitive | Atomic UI component with no business logic |
| Feature | Domain-specific page component composing primitives and shells |
| data-role-theme | HTML attribute on wrapper element that activates role-specific CSS variable preset |

---

*BLUEPRINT v2.0.0 — This document is the authoritative specification for any project initialized from this template. All implementation decisions must conform to the contracts defined herein. Replace all `{{PLACEHOLDER}}` values before use.*

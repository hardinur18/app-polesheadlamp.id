# 03 - Leads and Prospects

Status: Planning reference
Date: 2026-05-01
Scope: Leads, prospects, booking conversion, WA templates

## Purpose

Modul ini mengelola lead, prospek, kontak sosial, booking prospek, dan template WA.

## Current Entry Files

- `src/app/pages/Prospek.tsx`
- `src/app/pages/prospects/ProspectList.tsx`
- `src/app/pages/leads/LeadForm.tsx`
- `src/app/pages/leads/ProspectBookingForm.tsx`
- `src/app/pages/leads/WATemplatesDialog.tsx`
- `src/app/pages/WATemplatesPage.tsx`
- `src/app/pages/master-data/context/internal/leadSocialAdapter.ts`

## Current Navigation Ids

- `leads`
- `prospek`
- `wa-templates`

## Target Routes

- `/leads`
- `/leads/templates`

## Permissions

- `leads.view`
- related create/update/delete permissions from `permissions.ts`

## Data Sources

- `leads`
- `prospect_bookings`
- `wa_templates`
- lead social contact endpoint through Edge Function
- master data for branches, areas, services, sources, and users

## Service/API Boundary

- direct Supabase access remains legacy-compatible
- lead social contact uses internal adapter
- future writes that affect conversion should be reviewed before moving behind API

## Migration Risks

- lead list filters reset on route changes
- conversion to order changes behavior
- WA template access changes
- lead social contact sync regresses

## No-Regression Checklist

- CS can view leads
- lead create/edit still works
- booking form still works
- conversion path to order still works
- WA template page still opens
- lead social contacts remain visible

## First Safe Upgrade Step

Map `/leads` to existing `activeTab: 'leads'` and `/leads/templates` to `activeTab: 'wa-templates'`.

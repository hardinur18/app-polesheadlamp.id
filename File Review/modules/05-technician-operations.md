# 05 - Technician Operations

Status: Planning reference
Date: 2026-05-01
Scope: Technician mobile, technician schedule, field monitoring

## Purpose

Modul ini mendukung teknisi di lapangan dan monitoring pekerjaan teknisi.

## Current Entry Files

- `src/app/pages/TeknisiMobile.tsx`
- `src/app/pages/technician/TechnicianSchedulePage.tsx`
- `src/app/pages/technician/TechnicianDashboard.tsx`
- `src/app/pages/technician/TechnicianStats.tsx`
- `src/app/pages/MonitoringPage.tsx`
- `src/app/pages/Pemantauan.tsx`

## Current Navigation Ids

- `teknisi-mobile`
- `technician-schedule`
- `monitoring-activity`
- `monitoring`

## Target Routes

- `/technician/mobile`
- `/technician/schedule`
- `/monitoring/activity`
- `/monitoring`

## Permissions

- `teknisi.view_mobile`
- monitoring-related permissions from current mapping

## Data Sources

- `orders`
- `technician_schedules`
- technician daily report endpoints
- shift endpoints
- mobile technician endpoints

## Migration Risks

- technician role opens desktop shell
- mobile bottom nav changes behavior
- assignment/status update changes behavior
- monitoring page becomes inaccessible for allowed roles

## No-Regression Checklist

- technician login lands on technician mobile experience
- technician can see assigned jobs
- schedule page remains available for authorized roles
- monitoring pages still open for authorized roles
- desktop sidebar remains hidden where currently hidden

## First Safe Upgrade Step

Define technician route intent and preserve role-specific fallback before wiring routes.

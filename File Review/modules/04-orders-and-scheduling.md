# 04 - Orders and Scheduling

Status: Planning reference
Date: 2026-05-01
Scope: Orders, order forms, payments inside order flow, schedule

## Purpose

Modul ini mengelola order, detail order, pembayaran order, invoice preview, dan jadwal operasional.

## Current Entry Files

- `src/app/pages/Pesanan.tsx`
- `src/app/pages/Schedule.tsx`
- `src/app/pages/orders/OrderForm.tsx`
- `src/app/pages/orders/OrderDetailDialog.tsx`
- `src/app/pages/orders/OrderPaymentDialog.tsx`
- `src/app/pages/orders/OrderQrisPanel.tsx`
- `src/app/services/orderPaymentService.ts`
- `src/app/services/orderScheduleValidation.ts`
- `src/app/services/orderTime.ts`

## Current Navigation Ids

- `orders`
- `schedule`

## Target Routes

- `/orders`
- `/schedule`

## Permissions

- `order.view`
- related order create/update permissions from `permissions.ts`
- schedule-related permissions from current mapping

## Data Sources

- `orders`
- `leads`
- `technician_schedules`
- `payment_transactions`
- branches, areas, services, vehicle types, payment methods
- payments Edge Function for QRIS/payment flow

## Service/API Boundary

- order payment logic already has service layer
- schedule validation already has service helper
- bulk movement of order CRUD behind API should be deferred

## Migration Risks

- order form callback navigation breaks
- payment dialog behavior changes
- schedule conflict validation changes
- order status transition changes
- route refresh loses open dialog state

## No-Regression Checklist

- order list opens
- order create/edit works
- order detail opens
- payment dialog works
- QRIS panel works
- schedule page opens
- navigation from leads to orders still works

## First Safe Upgrade Step

Map `/orders` and `/schedule` to existing tab ids without changing order components.

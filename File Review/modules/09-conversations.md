# 09 - Conversations

Status: Planning reference
Date: 2026-05-01
Scope: Conversation center, live inbox, channel settings

## Purpose

Modul ini mengelola inbox percakapan dan pengaturan channel percakapan.

## Current Entry Files

- `src/app/pages/conversations/ConversationLiveInboxPage.tsx`
- `src/app/pages/conversations/ConversationChannelSettingsPage.tsx`
- `src/app/pages/conversations/conversationWorkspace.ts`
- `src/app/services/conversationCenterService.ts`
- `src/app/pages/conversations/components/ConversationWorkspaceFrame.tsx`

## Current Navigation Ids

- `conversation-center`
- `conversation-live-inbox`
- `conversation-channel-settings`

## Target Routes

- `/conversations`
- `/conversations/inbox`
- `/conversations/channel-settings`

## Permissions

- conversation and leads-related permissions from current mapping
- some surfaces likely use `leads.view`

## Data Sources

- Meta messaging readiness endpoint
- Meta messaging assets sync endpoint
- Meta messaging inbox overview endpoint
- Meta messaging daily stats endpoint
- Meta messaging messages endpoint
- Meta messaging send endpoint

## Service/API Boundary

- keep messaging integration behind `conversationCenterService`
- no direct third-party token usage in frontend
- public webhook remains separate

## Migration Risks

- live inbox loses selected channel
- settings route opens without required readiness data
- Marketing OS conversation hub overlaps with classic conversation center

## No-Regression Checklist

- live inbox opens
- channel settings opens
- readiness check still works
- message list still loads
- send flow remains protected by existing service behavior

## First Safe Upgrade Step

Map `/conversations/inbox` to the current live inbox tab and keep `/conversations` as an alias.

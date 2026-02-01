# Task 85: Fix Slack Settings Page UI Inconsistency

## Status: Open
## Priority: Medium
## Date: 2026-02-01

## Summary
The Slack configuration section in Settings uses a different visual style than the rest of the application, breaking UI consistency.

## Current Issues

### 1. Color Scheme Mismatch
- Rest of app: Dark theme with dark backgrounds
- Slack section: Light/cream colored backgrounds for instruction cards and input areas
- Warning banner uses yellow background that clashes with dark theme

### 2. Card Styling
- The instruction card (with setup steps) uses a light background
- Should use the same dark card style as other settings sections (General, Roles, Skills tabs)

### 3. Input Field Styling
- Token input fields have inconsistent styling compared to other form inputs in the app
- Should match the dark input field style used in General settings tab

## Screenshots
The Slack tab shows:
- Yellow warning banner "Not connected to Slack"
- Light beige/cream instruction card
- Input fields with different styling than other tabs

## Proposed Solution
Update `frontend/src/components/Settings/SlackTab.tsx` to:
1. Use consistent dark card backgrounds (`bg-gray-800` or similar)
2. Match input field styling with other tabs
3. Use theme-consistent alert/warning colors
4. Follow the same component patterns as GeneralTab, RolesTab, SkillsTab

## Files to Modify
- `frontend/src/components/Settings/SlackTab.tsx`
- Possibly shared style constants if they exist

## Acceptance Criteria
1. Slack tab uses same dark theme as rest of Settings page
2. Input fields match styling of General tab inputs
3. Warning/status banners use theme-consistent colors
4. No visual jarring when switching between Settings tabs

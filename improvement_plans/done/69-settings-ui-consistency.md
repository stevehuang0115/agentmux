# Task 69: Fix Settings Page UI Consistency

## Priority: High

## Problem

The Settings page uses a different visual style compared to the rest of the application. Specifically:
- Light/white background in the content area vs dark theme used elsewhere
- Tab styling doesn't match the application's overall theme
- Card components have different styling (light yellow warning boxes, white forms)

The Settings page should match the dark-themed, consistent UI used throughout the rest of Crewly.

## Current Issues

### 1. Background Color Mismatch
- Settings page: White/light gray background
- Other pages: Dark background (consistent with sidebar)

### 2. Tab Styling Inconsistency
- Settings tabs: Light-styled with underline
- Should match: Application's dark theme

### 3. Form/Card Styling
- Settings forms: White backgrounds with light borders
- Should use: Dark card backgrounds matching theme

### 4. Warning/Alert Boxes
- Current: Light yellow backgrounds
- Should use: Theme-appropriate alert colors (dark yellow/amber on dark)

## Implementation

### 1. Update Settings Page CSS

**File:** `frontend/src/pages/Settings.css`

```css
/* Settings page container */
.settings-page {
  padding: 24px;
  min-height: 100%;
  color: var(--text-primary);
}

.settings-page h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.settings-page .page-subtitle {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* Tab navigation - match app theme */
.settings-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0;
}

.settings-tab {
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.settings-tab:hover {
  color: var(--text-primary);
  background: var(--hover-background);
}

.settings-tab.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.settings-tab svg {
  width: 16px;
  height: 16px;
}

/* Settings content cards */
.settings-card {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
}

.settings-card h2,
.settings-card h3 {
  color: var(--text-primary);
  margin-bottom: 16px;
}

/* Form elements */
.settings-form-group {
  margin-bottom: 20px;
}

.settings-form-group label {
  display: block;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-size: 0.875rem;
}

.settings-input,
.settings-select,
.settings-textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--input-background);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.settings-input:focus,
.settings-select:focus,
.settings-textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.settings-input::placeholder {
  color: var(--text-muted);
}

/* Alert/Warning boxes - dark theme appropriate */
.settings-alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-alert.warning {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.settings-alert.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.settings-alert.success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.settings-alert.info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

/* Buttons */
.settings-btn {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.settings-btn-primary {
  background: var(--accent-color);
  color: white;
}

.settings-btn-primary:hover {
  background: var(--accent-hover);
}

.settings-btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.settings-btn-secondary:hover {
  background: var(--hover-background);
}

/* List items (roles, skills) */
.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.settings-list-item:hover {
  border-color: var(--accent-color);
}

.settings-list-item-info h4 {
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.settings-list-item-info p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.875rem;
}
```

### 2. Update CSS Variables

Ensure these variables are defined in the root or theme CSS:

```css
:root {
  /* Dark theme colors */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --card-background: #1e293b;
  --input-background: #0f172a;
  --border-color: #334155;
  --hover-background: rgba(255, 255, 255, 0.05);

  /* Text colors */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Accent colors */
  --accent-color: #3b82f6;
  --accent-hover: #2563eb;
}
```

### 3. Update Tab Components

The Settings tabs should use these updated styles by applying the appropriate CSS classes.

## Files to Modify

1. `frontend/src/pages/Settings.tsx` - Update className usage
2. `frontend/src/pages/Settings.css` - Major CSS overhaul (above)
3. `frontend/src/components/Settings/GeneralTab.tsx` - Update form styling
4. `frontend/src/components/Settings/RolesTab.tsx` - Update list styling
5. `frontend/src/components/Settings/SkillsTab.tsx` - Update list styling
6. `frontend/src/components/Settings/SlackTab.tsx` - Update alert/form styling (if exists)

## Testing Requirements

1. Settings page matches overall app dark theme
2. Tabs have consistent styling with hover/active states
3. Form inputs are readable on dark background
4. Alert/warning boxes are visible but theme-appropriate
5. List items (roles, skills) have consistent card styling
6. Buttons match app button styles

## Acceptance Criteria

- [ ] Settings page uses dark background matching app theme
- [ ] Tab navigation styled consistently
- [ ] Form inputs use dark theme styling
- [ ] Alert boxes use dark theme appropriate colors
- [ ] Cards and list items match app styling
- [ ] No white/light backgrounds that contrast with theme
- [ ] All text is readable (proper contrast)
- [ ] Hover and active states work correctly

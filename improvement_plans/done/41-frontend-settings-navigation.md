# Task: Add Settings Link to Navigation

## Overview

Add a Settings link to the frontend navigation/sidebar so users can access the Settings page. Currently, the Settings page exists and has a route, but there's no navigation link to it.

## Priority

**Medium** - Users need a way to navigate to Settings

## Dependencies

- `37-frontend-settings-route.md` - Settings route must be added first

## Gap Identified

The navigation/sidebar components don't include a link to the Settings page at `/settings`.

## Files to Modify

### Option 1: Update Sidebar Component

If using a sidebar navigation, update `frontend/src/components/Layout/Sidebar.tsx`:

```typescript
// Add to navigation items array
const navigationItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/projects', label: 'Projects', icon: '📁' },
  { path: '/teams', label: 'Teams', icon: '👥' },
  { path: '/assignments', label: 'Assignments', icon: '📋' },
  { path: '/scheduled-checkins', label: 'Scheduled Check-ins', icon: '⏰' },
  { path: '/factory', label: 'Factory', icon: '🏭' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },  // ADD THIS
];
```

### Option 2: Update AppLayout Header

If settings should be in the header, update `frontend/src/components/Layout/AppLayout.tsx`:

```tsx
import { Link } from 'react-router-dom';

// In the header section
<header className="app-header">
  <h1>Crewly</h1>
  <nav className="header-nav">
    <Link to="/settings" className="settings-link">
      ⚙️ Settings
    </Link>
  </nav>
</header>
```

### Option 3: Add Settings Icon Button

For a more subtle approach, add a settings icon in the header:

```tsx
import { Link } from 'react-router-dom';

<Link to="/settings" className="settings-icon-btn" title="Settings">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
</Link>
```

## Recommended Approach

Based on the existing layout, add Settings to both:
1. **Sidebar** - As a main navigation item at the bottom
2. **Header** - As a quick-access icon (optional)

### Sidebar Placement

Settings should appear at the bottom of the sidebar, separated from main navigation:

```tsx
<nav className="sidebar-nav">
  {/* Main navigation */}
  <div className="nav-section">
    <NavLink to="/">Dashboard</NavLink>
    <NavLink to="/projects">Projects</NavLink>
    <NavLink to="/teams">Teams</NavLink>
    {/* ... other main links ... */}
  </div>

  {/* Settings at bottom */}
  <div className="nav-section nav-footer">
    <NavLink to="/settings" className="settings-link">
      ⚙️ Settings
    </NavLink>
  </div>
</nav>
```

## CSS Additions

Add styles for the settings link:

```css
.settings-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 6px;
  transition: background-color 0.2s, color 0.2s;
}

.settings-link:hover {
  background-color: var(--hover-bg);
  color: var(--text-primary);
}

.settings-link.active {
  background-color: var(--active-bg);
  color: var(--primary-color);
}

.nav-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}
```

## Verification

After making changes:

1. Start the frontend: `cd frontend && npm run dev`
2. Verify Settings link appears in navigation
3. Click the link and verify it navigates to `/settings`
4. Verify the link shows active state when on Settings page

## Acceptance Criteria

- [ ] Settings link visible in navigation/sidebar
- [ ] Link navigates to /settings page
- [ ] Link shows active state when on Settings page
- [ ] Settings icon/label is clear and recognizable
- [ ] Placement is consistent with design patterns
- [ ] Responsive design works on mobile

## Testing Requirements

Update navigation tests to include Settings link:

```typescript
it('should render Settings link in navigation', () => {
  render(<Sidebar />);
  expect(screen.getByText('Settings')).toBeInTheDocument();
});

it('should navigate to Settings page when clicked', async () => {
  render(<App />);
  fireEvent.click(screen.getByText('Settings'));
  expect(window.location.pathname).toBe('/settings');
});
```

## Estimated Effort

5 minutes

## Notes

- Follow existing navigation styling patterns
- Consider adding tooltip for icon-only button
- Settings link is typically placed at the bottom of sidebar
- Use react-router's NavLink for active state handling

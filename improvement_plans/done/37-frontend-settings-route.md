# Task: Add Settings Route to Frontend App

## Overview

Add the Settings page route to the frontend React Router configuration. The Settings page component exists but is not accessible because it's not included in the router.

## Priority

**Critical** - Settings page is not accessible without this route

## Dependencies

- `27-frontend-settings-page.md` - Settings page component must exist

## Gap Identified

The Settings page exists at `frontend/src/pages/Settings.tsx` but is not added to the routes in `frontend/src/App.tsx`.

## Files to Modify

### Update `frontend/src/App.tsx`

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Teams } from './pages/Teams';
import { TeamDetail } from './pages/TeamDetail';
import { Assignments } from './pages/Assignments';
import { ScheduledCheckins } from './pages/ScheduledCheckins';
import { Factory } from './pages/Factory';
import { Settings } from './pages/Settings';  // ADD THIS IMPORT
import { TerminalProvider } from './contexts/TerminalContext';
import { SidebarProvider } from './contexts/SidebarContext';

function App() {
  return (
    <TerminalProvider>
      <SidebarProvider>
        <Router>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="teams" element={<Teams />} />
              <Route path="teams/:id" element={<TeamDetail />} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="scheduled-checkins" element={<ScheduledCheckins />} />
              <Route path="factory" element={<Factory />} />
              <Route path="settings" element={<Settings />} />  {/* ADD THIS ROUTE */}
            </Route>
          </Routes>
        </Router>
      </SidebarProvider>
    </TerminalProvider>
  );
}

export default App;
```

## Verification

After making changes:

1. Start the frontend dev server: `cd frontend && npm run dev`
2. Navigate to `http://localhost:5173/settings`
3. Verify the Settings page renders with tabs (General, Roles, Skills)

## Acceptance Criteria

- [ ] Settings import added to App.tsx
- [ ] Settings route added at path "/settings"
- [ ] Settings page accessible via direct URL
- [ ] Settings page renders correctly with all tabs
- [ ] No console errors when navigating to Settings

## Testing Requirements

Update `frontend/src/App.test.tsx` if it exists to include Settings route test:

```typescript
it('renders Settings page at /settings route', () => {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <App />
    </MemoryRouter>
  );

  expect(screen.getByText('Settings')).toBeInTheDocument();
});
```

## Estimated Effort

2 minutes

## Notes

- The Settings page should be nested under AppLayout to maintain consistent navigation
- Ensure the import uses the correct path and extension based on project conventions

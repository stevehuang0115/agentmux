# Task: Add ChatProvider to Frontend App

## Overview

Wrap the frontend application with ChatProvider so that the ChatContext is available throughout the app. Currently, the ChatContext exists but the provider is not included in the App component tree.

## Priority

**Critical** - Chat features will not work without the context provider

## Dependencies

- `33-frontend-chat-components.md` - ChatContext must exist

## Gap Identified

The ChatContext and ChatProvider exist at `frontend/src/contexts/ChatContext.tsx` but the provider is not wrapping the app in `frontend/src/App.tsx`.

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
import { Settings } from './pages/Settings';
import { TerminalProvider } from './contexts/TerminalContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ChatProvider } from './contexts/ChatContext';  // ADD THIS IMPORT

function App() {
  return (
    <ChatProvider>  {/* ADD THIS WRAPPER */}
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
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Router>
        </SidebarProvider>
      </TerminalProvider>
    </ChatProvider>  {/* CLOSE WRAPPER */}
  );
}

export default App;
```

## Provider Order Consideration

The ChatProvider should be at the outermost level (or near it) because:
1. Chat state needs to persist across route changes
2. Chat may need to be accessible from any component
3. It doesn't depend on Router context

Recommended order (outermost to innermost):
1. ChatProvider
2. TerminalProvider
3. SidebarProvider
4. Router

## Verification

After making changes:

1. Start the frontend dev server: `cd frontend && npm run dev`
2. Open browser developer tools console
3. Navigate to Dashboard or any page with chat components
4. Verify no "useChat must be used within a ChatProvider" errors
5. Test chat functionality if available on the page

## Acceptance Criteria

- [ ] ChatProvider import added to App.tsx
- [ ] ChatProvider wraps the entire app component tree
- [ ] No context-related errors in console
- [ ] Chat components can access ChatContext
- [ ] useChat hook works in any component

## Testing Requirements

Update `frontend/src/App.test.tsx` to ensure ChatProvider doesn't break existing tests:

```typescript
import { ChatProvider } from './contexts/ChatContext';

// Wrap test renders with ChatProvider if needed
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ChatProvider>
      {ui}
    </ChatProvider>
  );
};
```

## Estimated Effort

2 minutes

## Notes

- ChatProvider initializes WebSocket connection for real-time updates
- Ensure ChatProvider handles errors gracefully (e.g., if backend is not running)
- Consider lazy initialization if chat is not used on all pages

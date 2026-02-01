# Task 68: Create Dedicated Chat Page

## Priority: Critical

## Problem

The chat interface is currently embedded in the Dashboard, replacing the original dashboard layout. The user wants a **dedicated Chat page** at a separate route (`/chat`) while restoring the original Dashboard.

## Implementation

### 1. Create Chat Page

**New File:** `frontend/src/pages/Chat.tsx`

```typescript
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ChatProvider } from '../contexts/ChatContext';
import './Chat.css';

export function Chat() {
  return (
    <ChatProvider>
      <div className="chat-page">
        <div className="chat-page-header">
          <h1>Chat with Orchestrator</h1>
          <p>Communicate with the AgentMux orchestrator to manage projects and teams</p>
        </div>
        <div className="chat-page-content">
          <ChatPanel />
        </div>
      </div>
    </ChatProvider>
  );
}

export default Chat;
```

### 2. Chat Page Styles

**New File:** `frontend/src/pages/Chat.css`

```css
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px); /* Subtract header height */
  padding: 24px;
}

.chat-page-header {
  margin-bottom: 24px;
}

.chat-page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.chat-page-header p {
  color: var(--text-secondary);
  margin: 0;
}

.chat-page-content {
  flex: 1;
  min-height: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-background);
  border: 1px solid var(--border-color);
}
```

### 3. Add Route to App.tsx

**Update File:** `frontend/src/App.tsx`

```typescript
import { Chat } from './pages/Chat';

// Add to routes
<Route path="/chat" element={<Chat />} />
```

### 4. Add Navigation Link

**Update File:** `frontend/src/components/Layout/Sidebar.tsx`

Add Chat link to the sidebar navigation:

```typescript
// Add to navigation items
{
  to: '/chat',
  icon: <ChatIcon />,
  label: 'Chat'
}
```

Navigation order should be:
1. Dashboard
2. Projects
3. Teams
4. Schedules
5. **Chat** (new)
6. Settings
7. Mobile Access

### 5. Move ChatProvider

The `ChatProvider` should be moved from wrapping the entire app to only wrapping the Chat page. This keeps chat state isolated to the chat page.

## File Structure After Changes

```
frontend/src/
├── pages/
│   ├── Dashboard.tsx      # Restored original cards layout
│   ├── Chat.tsx           # New dedicated chat page
│   └── Chat.css           # Chat page styles
├── components/
│   └── Chat/              # Existing chat components (reuse)
│       ├── ChatPanel.tsx
│       ├── ChatMessage.tsx
│       ├── ChatInput.tsx
│       └── ChatSidebar.tsx
└── contexts/
    └── ChatContext.tsx    # Used only by Chat page
```

## Dependencies

- Task 67 (Restore Original Dashboard) - Dashboard must be restored first
- Existing Chat components can be reused as-is

## Testing Requirements

1. Navigate to `/chat` route
2. Chat interface displays correctly
3. Chat sidebar shows conversations
4. Message input works
5. Messages display properly
6. Navigation between Dashboard and Chat works

## Acceptance Criteria

- [ ] Chat page exists at `/chat` route
- [ ] Chat icon added to sidebar navigation
- [ ] ChatProvider wraps only the Chat page (not entire app)
- [ ] All existing chat functionality preserved
- [ ] Page header with title and description
- [ ] Full-height layout that fills available space
- [ ] Styling consistent with app theme

# Ticket 004: Extract Duplicate Avatar Rendering into Shared Component

## Priority: High
## Estimated Effort: Small
## Component: Frontend

---

## Problem Description

Avatar rendering logic is duplicated across multiple components (`TeamsGridCard.tsx`, `TeamListItem.tsx`, potentially others). This complex nested ternary logic should be extracted into a reusable `<MemberAvatar>` component.

---

## Files Affected

| File | Lines | Issue |
|------|-------|-------|
| `frontend/src/components/Teams/TeamsGridCard.tsx` | 44-62 | Duplicate avatar logic |
| `frontend/src/components/Teams/TeamListItem.tsx` | (similar) | Duplicate avatar logic |

---

## Detailed Instructions

### Step 1: Create the MemberAvatar Component

**File:** `frontend/src/components/common/MemberAvatar.tsx`

```typescript
import React from 'react';

export interface MemberAvatarProps {
  /** The member's name (used for fallback initial) */
  name: string;
  /** Avatar URL, data URI, or emoji/character */
  avatar?: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Show online/offline indicator */
  showStatus?: boolean;
  /** Status: active, inactive, activating */
  status?: 'active' | 'inactive' | 'activating';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const statusColors = {
  active: 'bg-green-500',
  inactive: 'bg-gray-400',
  activating: 'bg-yellow-500',
};

/**
 * Renders a member avatar with support for images, data URIs, emojis, or initials fallback.
 *
 * @param props - MemberAvatarProps
 * @returns Avatar element
 *
 * @example
 * ```tsx
 * <MemberAvatar name="John Doe" avatar="https://example.com/avatar.jpg" size="md" />
 * <MemberAvatar name="Jane" avatar="🤖" size="sm" />
 * <MemberAvatar name="Bob" size="lg" /> // Shows "B" initial
 * ```
 */
export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  avatar,
  size = 'md',
  className = '',
  showStatus = false,
  status,
}) => {
  const sizeClass = sizeClasses[size];

  const renderAvatar = () => {
    // Case 1: Avatar is a URL (http/https) or data URI
    if (avatar && (avatar.startsWith('http') || avatar.startsWith('data:'))) {
      return (
        <img
          src={avatar}
          alt={`${name}'s avatar`}
          className={`${sizeClass} rounded-full object-cover ${className}`}
        />
      );
    }

    // Case 2: Avatar is an emoji or character
    if (avatar) {
      return (
        <div
          className={`${sizeClass} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
          title={name}
        >
          <span>{avatar}</span>
        </div>
      );
    }

    // Case 3: No avatar - show initial
    const initial = name.charAt(0).toUpperCase();
    return (
      <div
        className={`${sizeClass} rounded-full bg-blue-500 text-white flex items-center justify-center font-medium ${className}`}
        title={name}
      >
        {initial}
      </div>
    );
  };

  return (
    <div className="relative inline-block">
      {renderAvatar()}
      {showStatus && status && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 ${statusColors[status]} rounded-full border-2 border-white dark:border-gray-800`}
          title={status}
        />
      )}
    </div>
  );
};

export default MemberAvatar;
```

### Step 2: Create Test File

**File:** `frontend/src/components/common/MemberAvatar.test.tsx`

```typescript
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemberAvatar } from './MemberAvatar';

describe('MemberAvatar', () => {
  describe('rendering modes', () => {
    it('should render image when avatar is a URL', () => {
      render(
        <MemberAvatar
          name="John Doe"
          avatar="https://example.com/avatar.jpg"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(img).toHaveAttribute('alt', "John Doe's avatar");
    });

    it('should render image when avatar is a data URI', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
      render(<MemberAvatar name="Jane" avatar={dataUri} />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', dataUri);
    });

    it('should render emoji/character when avatar is not a URL', () => {
      render(<MemberAvatar name="Bot" avatar="🤖" />);

      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should render initial when no avatar is provided', () => {
      render(<MemberAvatar name="Alice" />);

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should handle empty name gracefully', () => {
      render(<MemberAvatar name="" />);

      // Should not crash, might show empty or nothing
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should apply xs size classes', () => {
      const { container } = render(
        <MemberAvatar name="Test" size="xs" />
      );

      expect(container.firstChild?.firstChild).toHaveClass('w-6', 'h-6');
    });

    it('should apply md size classes by default', () => {
      const { container } = render(<MemberAvatar name="Test" />);

      expect(container.firstChild?.firstChild).toHaveClass('w-10', 'h-10');
    });

    it('should apply xl size classes', () => {
      const { container } = render(
        <MemberAvatar name="Test" size="xl" />
      );

      expect(container.firstChild?.firstChild).toHaveClass('w-16', 'h-16');
    });
  });

  describe('status indicator', () => {
    it('should show status indicator when showStatus is true', () => {
      const { container } = render(
        <MemberAvatar name="Test" showStatus status="active" />
      );

      const statusIndicator = container.querySelector('.bg-green-500');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should not show status indicator by default', () => {
      const { container } = render(
        <MemberAvatar name="Test" status="active" />
      );

      const statusIndicator = container.querySelector('.bg-green-500');
      expect(statusIndicator).not.toBeInTheDocument();
    });

    it('should show yellow for activating status', () => {
      const { container } = render(
        <MemberAvatar name="Test" showStatus status="activating" />
      );

      const statusIndicator = container.querySelector('.bg-yellow-500');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should show gray for inactive status', () => {
      const { container } = render(
        <MemberAvatar name="Test" showStatus status="inactive" />
      );

      const statusIndicator = container.querySelector('.bg-gray-400');
      expect(statusIndicator).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have alt text for images', () => {
      render(
        <MemberAvatar
          name="John"
          avatar="https://example.com/avatar.jpg"
        />
      );

      expect(screen.getByRole('img')).toHaveAttribute('alt', "John's avatar");
    });

    it('should have title attribute for non-image avatars', () => {
      const { container } = render(<MemberAvatar name="Jane" avatar="🤖" />);

      expect(container.querySelector('[title="Jane"]')).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <MemberAvatar name="Test" className="custom-class" />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});
```

### Step 3: Create Index File for Common Components

**File:** `frontend/src/components/common/index.ts`

```typescript
export { MemberAvatar } from './MemberAvatar';
export type { MemberAvatarProps } from './MemberAvatar';
```

### Step 4: Update TeamsGridCard.tsx

**File:** `frontend/src/components/Teams/TeamsGridCard.tsx`

**Before (Lines 44-62):**
```typescript
{avatars.map((m, idx) => (
  m.avatar ? (
    (m.avatar.startsWith('http') || m.avatar.startsWith('data:')) ? (
      <img
        key={idx}
        src={m.avatar}
        alt={m.name}
        className="w-8 h-8 rounded-full object-cover border-2 border-white -ml-2 first:ml-0"
      />
    ) : (
      <div
        key={idx}
        className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white -ml-2 first:ml-0"
      >
        {m.avatar}
      </div>
    )
  ) : (
    <div
      key={idx}
      className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium border-2 border-white -ml-2 first:ml-0"
    >
      {m.name.charAt(0).toUpperCase()}
    </div>
  )
))}
```

**After:**
```typescript
import { MemberAvatar } from '../common/MemberAvatar';

// In the JSX:
{avatars.map((m, idx) => (
  <div key={idx} className={idx > 0 ? '-ml-2' : ''}>
    <MemberAvatar
      name={m.name}
      avatar={m.avatar}
      size="sm"
      className="border-2 border-white"
    />
  </div>
))}
```

### Step 5: Update TeamListItem.tsx

**File:** `frontend/src/components/Teams/TeamListItem.tsx`

Apply the same refactoring pattern, replacing inline avatar logic with `<MemberAvatar />`.

---

## Evaluation Criteria

### Automated Verification

```bash
cd frontend

# 1. New component exists
test -f src/components/common/MemberAvatar.tsx && echo "PASS" || echo "FAIL"
test -f src/components/common/MemberAvatar.test.tsx && echo "PASS" || echo "FAIL"

# 2. Build succeeds
npm run build

# 3. Tests pass
npm test -- --grep "MemberAvatar"

# 4. No duplicate avatar logic
grep -c "avatar.startsWith" src/components/Teams/TeamsGridCard.tsx
# Expected: 0 (logic moved to MemberAvatar)

# 5. Full test suite passes
npm test
```

### Manual Verification Checklist

- [ ] `MemberAvatar` component created with full functionality
- [ ] Test file created with comprehensive coverage
- [ ] `TeamsGridCard.tsx` updated to use `MemberAvatar`
- [ ] `TeamListItem.tsx` updated to use `MemberAvatar`
- [ ] Visual appearance unchanged in UI
- [ ] All avatar types work (URL, data URI, emoji, initial)
- [ ] Status indicators display correctly

---

## Rollback Plan

```bash
git checkout HEAD -- frontend/src/components/Teams/TeamsGridCard.tsx
git checkout HEAD -- frontend/src/components/Teams/TeamListItem.tsx
rm -rf frontend/src/components/common/
```

---

## Dependencies

- None

## Blocks

- None

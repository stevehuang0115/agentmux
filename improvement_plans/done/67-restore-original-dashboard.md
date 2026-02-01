# Task 67: Restore Original Dashboard Layout

## Priority: Critical

## Problem

The Dashboard page (`/`) has been replaced with a chat-centric interface, but the user wants to restore the original cards-based dashboard layout as defined in `specs/frontend-design.md`.

### Current State (Unwanted)
- Dashboard shows a chat interface with conversations sidebar
- Chat panel takes up the main content area
- Quick links to Projects, Teams, Settings at the bottom
- Message input for orchestrator communication

### Desired State (Original Design)
- **Projects Section** with ProjectCard components in a grid
- **Teams Section** with TeamCard components in a grid
- "View All" buttons linking to respective pages
- "Create Card" components for adding new projects/teams

## Implementation

### File to Modify

`frontend/src/pages/Dashboard.tsx`

### Target Implementation

```typescript
// pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectCard } from '../components/ProjectCard/ProjectCard';
import { TeamCard } from '../components/TeamCard/TeamCard';
import { CreateCard } from '../components/Cards/CreateCard';
import { projectsService } from '../services/projects.service';
import { teamsService } from '../services/teams.service';
import type { Project, Team } from '../types';
import './Dashboard.css';

export function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectsData, teamsData] = await Promise.all([
          projectsService.getProjects(),
          teamsService.getTeams()
        ]);
        setProjects(projectsData.slice(0, 4)); // Show top 4
        setTeams(teamsData.slice(0, 4)); // Show top 4
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="dashboard">
      {/* Projects Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Projects</h2>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/projects')}
          >
            View All
          </button>
        </div>
        <div className="cards-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
          <CreateCard
            title="New Project"
            onClick={() => navigate('/projects?create=true')}
          />
        </div>
      </section>

      {/* Teams Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Teams</h2>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/teams')}
          >
            View All
          </button>
        </div>
        <div className="cards-grid">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onClick={() => navigate(`/teams/${team.id}`)}
            />
          ))}
          <CreateCard
            title="New Team"
            onClick={() => navigate('/teams?create=true')}
          />
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
```

### CSS Updates

```css
/* Dashboard.css */
.dashboard {
  padding: 24px;
}

.dashboard-section {
  margin-bottom: 48px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}
```

### CreateCard Component (if not exists)

```typescript
// components/Cards/CreateCard.tsx
interface CreateCardProps {
  title: string;
  onClick: () => void;
}

export function CreateCard({ title, onClick }: CreateCardProps) {
  return (
    <div
      className="create-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="create-card-icon">+</div>
      <span className="create-card-title">{title}</span>
    </div>
  );
}
```

## Dependencies

- Task 68 (Dedicated Chat Page) - Move chat functionality to /chat route

## Testing Requirements

1. Dashboard loads Projects and Teams sections
2. Cards display correctly in grid layout
3. "View All" buttons navigate to correct pages
4. "Create Card" components navigate to create flows
5. Loading state handled properly

## Acceptance Criteria

- [ ] Dashboard shows Projects section with cards grid
- [ ] Dashboard shows Teams section with cards grid
- [ ] "View All" buttons work correctly
- [ ] Create cards navigate to creation flows
- [ ] No chat interface on Dashboard page
- [ ] Responsive grid layout (auto-fill, minmax 320px)
- [ ] Styling matches original design spec

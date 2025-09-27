
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
// Corrected import path casing to 'Layout' for consistency.
import { AppLayout } from './components/Layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Teams } from './pages/Teams';
import { TeamDetail } from './pages/TeamDetail';
import { ScheduledMessages } from './pages/ScheduledMessages';
import { ProjectLayout } from './pages/ProjectLayout';
import { ProjectTasks } from './pages/ProjectTasks';
import { ProjectTeams } from './pages/ProjectTeams';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          
          <Route path="projects/:id" element={<ProjectLayout />}>
            <Route index element={<ProjectDetail />} />
            <Route path="tasks" element={<ProjectTasks />} />
            <Route path="teams" element={<ProjectTeams />} />
          </Route>

          <Route path="teams" element={<Teams />} />
          <Route path="teams/:id" element={<TeamDetail />} />
          <Route path="schedules" element={<ScheduledMessages />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;

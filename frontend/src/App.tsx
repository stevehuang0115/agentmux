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
import { ChatProvider } from './contexts/ChatContext';

function App() {
  return (
    <ChatProvider>
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
    </ChatProvider>
  );
}

export default App;
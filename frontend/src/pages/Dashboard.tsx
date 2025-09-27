import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ProjectCard } from '@/components/Cards/ProjectCard';
import TeamsGridCard from '@/components/Teams/TeamsGridCard';
import { CreateCard } from '@/components/Cards/CreateCard';
import { Team, Project, ApiResponse } from '@/types';
import axios from 'axios';
import { FolderOpen, Users, ArrowRight } from 'lucide-react';

const API_BASE = '/api';

interface ProjectProgress {
  projectId: string;
  progressPercent: number;
  progressLabel: string;
  progressBreakdown: {
    open: number;
    inProgress: number;
    pending: number;
    done: number;
    blocked: number;
    total: number;
  };
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsMap, setTeamsMap] = useState<Record<string, Team[]>>({});
  const [projectProgress, setProjectProgress] = useState<Record<string, ProjectProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const calculateProjectProgress = async (projectId: string): Promise<ProjectProgress> => {
    try {
      const tasksResponse = await axios.get<ApiResponse<any[]>>(`${API_BASE}/projects/${projectId}/tasks`);
      const tasks = tasksResponse.data.data || [];

      // Count tasks by status
      const breakdown = {
        open: 0,
        inProgress: 0,
        pending: 0,
        done: 0,
        blocked: 0,
        total: tasks.length
      };

      tasks.forEach(task => {
        const status = task.status?.toLowerCase() || 'pending';
        if (status === 'open') breakdown.open++;
        else if (status === 'in_progress' || status === 'in-progress') breakdown.inProgress++;
        else if (status === 'done' || status === 'completed') breakdown.done++;
        else if (status === 'blocked') breakdown.blocked++;
        else breakdown.pending++;
      });

      // Calculate progress percentage (done tasks / total tasks)
      const progressPercent = breakdown.total > 0
        ? Math.round((breakdown.done / breakdown.total) * 100)
        : 0;

      const progressLabel = `${breakdown.done} of ${breakdown.total} completed`;

      return {
        projectId,
        progressPercent,
        progressLabel,
        progressBreakdown: breakdown
      };
    } catch (error) {
      console.error(`Error calculating progress for project ${projectId}:`, error);
      return {
        projectId,
        progressPercent: 0,
        progressLabel: 'No tasks',
        progressBreakdown: { open: 0, inProgress: 0, pending: 0, done: 0, blocked: 0, total: 0 }
      };
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsResponse, teamsResponse] = await Promise.all([
        axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`),
        axios.get<ApiResponse<Team[]>>(`${API_BASE}/teams`)
      ]);

      if (projectsResponse.data.success) {
        const projectList = projectsResponse.data.data || [];
        setProjects(projectList);

        // Calculate progress for each project
        const progressPromises = projectList.map(project => calculateProjectProgress(project.id));
        const progressResults = await Promise.all(progressPromises);

        const progressMap = progressResults.reduce((acc, progress) => {
          acc[progress.projectId] = progress;
          return acc;
        }, {} as Record<string, ProjectProgress>);

        setProjectProgress(progressMap);
      }

      if (teamsResponse.data.success) {
        let teamList = teamsResponse.data.data || [];

        // Avatar choices for migration
        const avatarChoices = [
          'https://picsum.photos/seed/1/64',
          'https://picsum.photos/seed/2/64',
          'https://picsum.photos/seed/3/64',
          'https://picsum.photos/seed/4/64',
          'https://picsum.photos/seed/5/64',
          'https://picsum.photos/seed/6/64',
        ];

        // Migrate teams without avatars for backward compatibility
        const migratedTeams = teamList.map(team => ({
          ...team,
          members: team.members.map((member: any, index: number) => ({
            ...member,
            avatar: member.avatar || avatarChoices[index % avatarChoices.length]
          }))
        }));

        setTeams(migratedTeams);

        // Create teams map for projects
        if (projectsResponse.data.success) {
          const projectList = projectsResponse.data.data || [];
          const teamsMapping = projectList.reduce((acc, project) => {
            const assignedTeams = migratedTeams.filter(team => {
              const matchesById = team.currentProject === project.id;
              const matchesByName = team.currentProject === project.name;
              return matchesById || matchesByName;
            });
            acc[project.id] = assignedTeams;
            return acc;
          }, {} as Record<string, Team[]>);
          setTeamsMap(teamsMapping);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToProjects = () => navigate('/projects');
  const navigateToTeams = () => navigate('/teams');
  const navigateToProject = (projectId: string) => navigate(`/projects/${projectId}`);
  const navigateToTeam = (teamId: string) => navigate(`/teams/${teamId}`);
  
  const openProjectCreator = () => {
    // This would open a modal or navigate to project creation
    navigate('/projects?create=true');
  };
  
  const openTeamCreator = () => {
    navigate('/teams?create=true');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        <p className="ml-3 text-text-secondary-dark">Loading dashboard...</p>
      </div>
    );
  }

  // Show top 2 projects and more teams on dashboard like prototype
  const topProjects = projects.slice(0, 2);
  const topTeams = teams.slice(0, 6); // Show up to 6 teams instead of 2

  const StatCard: React.FC<{title: string, value: string | number}> = ({title, value}) => (
    <div className="bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50">
      <p className="text-sm font-medium text-text-secondary-dark">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Welcome back. Here's a summary of your teams and projects.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Projects" value={projects.length} />
        <StatCard title="Teams" value={teams.length} />
        <StatCard title="Active Projects" value={projects.filter(p => p.status === 'active').length} />
        <StatCard title="Running Agents" value={teams.flatMap(t => t.members).filter(m => m.agentStatus === 'active').length} />
      </div>

      <div className="space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Projects</h3>
            <Link to="/projects" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {topProjects.map(project => {
              const progress = projectProgress[project.id];
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  showStatus
                  showTeams
                  assignedTeams={teamsMap[project.id] || []}
                  onClick={() => navigateToProject(project.id)}
                  progressPercent={progress?.progressPercent}
                  progressLabel={progress?.progressLabel}
                  progressBreakdown={progress?.progressBreakdown}
                />
              );
            })}
            <CreateCard
              title="Create New Project"
              onClick={openProjectCreator}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Teams</h3>
            <Link to="/teams" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {topTeams.map(team => (
              <TeamsGridCard
                key={team.id}
                team={team}
                onClick={() => navigateToTeam(team.id)}
              />
            ))}
            <CreateCard
              title="Create New Team"
              onClick={openTeamCreator}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
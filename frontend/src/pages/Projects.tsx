import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectCard } from '@/components/Cards/ProjectCard';
import { CreateCard } from '@/components/Cards/CreateCard';
import { ProjectCreator } from '@/components/Modals/ProjectCreator';
import { Project, ApiResponse } from '@/types';
import { apiService } from '@/services/api.service';
import axios from 'axios';
import { Plus, Search, Filter, Folder } from 'lucide-react';

const API_BASE = '/api';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreator, setShowCreator] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, {
    percent: number;
    active: number;
    total: number;
    open: number;
    inProgress: number;
    pending: number;
    done: number;
    blocked: number;
  }>>({});

  useEffect(() => {
    loadProjects();
    
    // Check if we should show creator modal
    if (searchParams.get('create') === 'true') {
      setShowCreator(true);
      // Remove the create param from URL
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`);
      
      if (response.data.success) {
        const list = response.data.data || [];
        setProjects(list);
        // Calculate progress asynchronously
        calculateProgressForProjects(list).catch(err => console.error('Progress calc failed:', err));
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgressForProjects = async (list: Project[]) => {
    const entries = await Promise.all(list.map(async (p) => {
      try {
        const tasks = await apiService.getAllTasks(p.id);
        const total = tasks.length;
        if (total === 0) return [p.id, { percent: 0, active: 0, total: 0, open: 0, inProgress: 0, pending: 0, done: 0, blocked: 0 }] as const;
        const open = tasks.filter((t: any) => t.status === 'open').length;
        const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
        const pending = tasks.filter((t: any) => t.status === 'pending').length;
        const done = tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
        const blocked = tasks.filter((t: any) => t.status === 'blocked').length;
        const active = open + inProgress + pending;
        const percent = Math.round((active / total) * 100);
        return [p.id, { percent, active, total, open, inProgress, pending, done, blocked }] as const;
      } catch (e) {
        console.warn('Failed to load tasks for project', p.id, e);
        return [p.id, { percent: 0, active: 0, total: 0, open: 0, inProgress: 0, pending: 0, done: 0, blocked: 0 }] as const;
      }
    }));
    setProgressMap(Object.fromEntries(entries));
  };

  const handleProjectCreate = async (path: string) => {
    try {
      const response = await axios.post<ApiResponse<Project>>(`${API_BASE}/projects`, { path });
      
      if (response.data.success && response.data.data) {
        setProjects(prev => [response.data.data!, ...prev]);
        setShowCreator(false);
        // Navigate to the new project
        navigate(`/projects/${response.data.data.id}`);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  const navigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // Filter projects based on search term and status
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.path.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-text-secondary-dark">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Manage and monitor your AgentMux projects</p>
        </div>

        <button
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          onClick={() => setShowCreator(true)}
        >
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-auto md:flex-grow max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-dark w-5 h-5" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-surface-dark border border-border-dark rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div>
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                showStatus
                showTeams
                onClick={() => navigateToProject(project.id)}
                progressPercent={progressMap[project.id]?.percent}
                progressLabel={typeof progressMap[project.id]?.total === 'number' ? `${progressMap[project.id]?.active || 0} active of ${progressMap[project.id]?.total || 0}` : undefined}
                progressBreakdown={progressMap[project.id] ? {
                  open: progressMap[project.id].open,
                  inProgress: progressMap[project.id].inProgress,
                  pending: progressMap[project.id].pending,
                  done: progressMap[project.id].done,
                  blocked: progressMap[project.id].blocked,
                  total: progressMap[project.id].total,
                } : undefined}
              />
            ))}

            <CreateCard
              title="New Project"
              onClick={() => setShowCreator(true)}
            />
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4">
              <Folder className="w-12 h-12 text-text-secondary-dark/50" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-sm text-text-secondary-dark mb-6">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first project to get started with AgentMux'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                onClick={() => setShowCreator(true)}
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            )}
          </div>
        )}
      </div>

      {/* Project Creator Modal */}
      {showCreator && (
        <ProjectCreator
          onSave={handleProjectCreate}
          onClose={() => setShowCreator(false)}
        />
      )}
    </div>
  );
};

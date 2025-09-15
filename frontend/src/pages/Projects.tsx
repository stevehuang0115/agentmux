import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectCard } from '@/components/Cards/ProjectCard';
import { CreateCard } from '@/components/Cards/CreateCard';
import { ProjectCreator } from '@/components/Modals/ProjectCreator';
import { Project, ApiResponse } from '@/types';
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
        setProjects(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="projects-loading">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="page projects-page">
      <header className="page-header">
        <div className="header-info">
          <h1 className="page-title">Projects</h1>
          <p className="page-description">
            Manage and monitor your AgentMux projects
          </p>
        </div>
        
        <button 
          className="primary-button"
          onClick={() => setShowCreator(true)}
        >
          <Plus className="button-icon" />
          New Project
        </button>
      </header>

      {/* Search and Filter Controls */}
      <div className="page-controls">
        <div className="search-control">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-control">
          <Filter className="filter-icon" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="projects-content">
        {filteredProjects.length > 0 ? (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                showStatus
                showTeams
                onClick={() => navigateToProject(project.id)}
              />
            ))}
            
            <CreateCard
              title="New Project"
              onClick={() => setShowCreator(true)}
            />
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <div className="empty-icon">
              <Folder size={48} strokeWidth={1.5} style={{ color: '#6B7280' }} />
            </div>
            <h3 className="empty-title">
              {searchTerm || filterStatus !== 'all' ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="empty-description">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first project to get started with AgentMux'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                className="primary-button"
                onClick={() => setShowCreator(true)}
                style={{ padding: '0.75rem 1.5rem', marginTop: '1rem' }}
              >
                <Plus className="button-icon" />
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
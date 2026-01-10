import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Grid, List } from 'lucide-react';
import { useAlert } from '../components/UI/Dialog';
import TeamsGridCard from '@/components/Teams/TeamsGridCard';
import { TeamModal } from '../components/Modals/TeamModal';
import { TeamMemberModal } from '../components/Modals/TeamMemberModal';
import { Team, TeamMember } from '../types';
import TeamListItem from '@/components/Teams/TeamListItem';
import { apiService } from '@/services/api.service';
import { logSilentError } from '@/utils/error-handling';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [projectsForFilter, setProjectsForFilter] = useState<{ id: string; name: string }[]>([]);
  const { showError, AlertComponent } = useAlert();
  const projectMap = Object.fromEntries(projectsForFilter.map(p => [p.id, p.name]));
  const [projectFilter, setProjectFilter] = useState<string>('all');

  useEffect(() => {
    fetchTeams();
    loadProjectsForFilter();
  }, []);

  const loadProjectsForFilter = async () => {
    try {
      const projects = await apiService.getProjects();
      setProjectsForFilter(projects.map(p => ({ id: p.id, name: p.name })));
    } catch (e) {
      logSilentError(e, { context: 'Loading projects for filter' });
    }
  };

  useEffect(() => {
    filterTeams();
  }, [teams, searchQuery, statusFilter]);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      if (response.ok) {
        const result = await response.json();
        // Handle API response structure that includes success/data fields
        let teamsData = result.success ? (result.data || []) : (result || []);
        // Ensure teamsData is an array
        teamsData = Array.isArray(teamsData) ? teamsData : [];

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
        const migratedTeams = teamsData.map(team => ({
          ...team,
          members: team.members.map((member: any, index: number) => ({
            ...member,
            avatar: member.avatar || avatarChoices[index % avatarChoices.length]
          }))
        }));

        setTeams(migratedTeams);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const filterTeams = () => {
    let filtered = teams;

    if (searchQuery) {
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (team.currentProject && team.currentProject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        team.members.some(member => 
          member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.role.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(team => {
        if (statusFilter === 'active') {
          return team.members.some(member => member.agentStatus === 'active');
        } else if (statusFilter === 'inactive') {
          return team.members.every(member => member.agentStatus === 'inactive');
        }
        return true;
      });
    }

    if (projectFilter !== 'all') {
      filtered = filtered.filter(team => team.currentProject === projectFilter);
    }

    setFilteredTeams(filtered);
  };

  const handleCreateTeam = async (teamData: any) => {
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamData),
      });

      if (response.ok) {
        const result = await response.json();
        const newTeam = result.success ? result.data : result;
        if (newTeam) {
          setTeams(prev => [...prev, newTeam]);
          setIsModalOpen(false);
        }
      } else {
        const errorResult = await response.json();
        showError('Error creating team: ' + (errorResult.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating team:', error);
      showError('Error creating team: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleTeamClick = (team: Team) => {
    navigate(`/teams/${team.id}`);
  };

  const handleMemberClick = (member: TeamMember, teamId: string) => {
    setSelectedMember(member);
    setSelectedTeamId(teamId);
  };

  const closeMemberModal = () => {
    setSelectedMember(null);
    setSelectedTeamId('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-text-secondary-dark">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teams</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Manage and organize your development teams</p>
        </div>

        <button
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="w-5 h-5" />
          New Team
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
        <div className="relative flex-grow w-full md:w-auto">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      {/* Filter + view controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-secondary-dark">Status:</span>
          <button className={`chip ${statusFilter === 'all' ? 'chip--active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
          <button className={`chip ${statusFilter === 'active' ? 'chip--active' : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
          <button className={`chip ${statusFilter === 'inactive' ? 'chip--active' : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
          <span className="ml-2 text-sm text-text-secondary-dark">Project:</span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="all">All</option>
            {projectsForFilter.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('grid')}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border-dark ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-secondary-dark hover:text-text-primary-dark hover:border-primary/50'}`}
            title="Grid view"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border-dark ${view === 'list' ? 'bg-primary/10 text-primary' : 'text-text-secondary-dark hover:text-text-primary-dark hover:border-primary/50'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(filteredTeams) && filteredTeams.map((team) => (
            <TeamsGridCard
              key={team.id}
              team={team}
              projectName={projectMap[team.currentProject || '']}
              onClick={() => handleTeamClick(team)}
              onViewTeam={(id) => navigate(`/teams/${id}`)}
              onEditTeam={(id) => navigate(`/teams/${id}?edit=true`)}
            />
          ))}
          <div
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center p-5 rounded-xl border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary"
          >
            <Plus className="mr-2 w-4 h-4" />
            <span>Create New Team</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.isArray(filteredTeams) && filteredTeams.map(team => (
            <TeamListItem
              key={team.id}
              team={team}
              projectName={projectMap[team.currentProject || '']}
              onClick={() => handleTeamClick(team)}
              onViewTeam={(id) => navigate(`/teams/${id}`)}
              onEditTeam={(id) => navigate(`/teams/${id}?edit=true`)}
              onDeleteTeam={(id) => {
                if (window.confirm('Are you sure you want to delete this team?')) {
                  // Add delete functionality here
                  console.log('Delete team:', id);
                }
              }}
            />
          ))}
          <div 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary"
          >
            <Plus className="mr-2 w-4 h-4" />
            <span>Create New Team</span>
          </div>
        </div>
      )}

      {filteredTeams.length === 0 && !loading && (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2">No teams found</h3>
          <p className="text-sm text-text-secondary-dark mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first team to get started'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-5 h-5" />
              Create Team
            </button>
          )}
        </div>
      )}

      <TeamModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTeam}
      />

      {selectedMember && selectedTeamId && (
        <TeamMemberModal
          member={selectedMember}
          teamId={selectedTeamId}
          onClose={closeMemberModal}
        />
      )}
      <AlertComponent />
    </div>
  );
};

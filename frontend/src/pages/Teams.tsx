import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TeamCard } from '../components/Cards/TeamCard';
import { CreateCard } from '../components/Cards/CreateCard';
import { TeamModal } from '../components/Modals/TeamModal';
import { TeamMemberModal } from '../components/Modals/TeamMemberModal';
import { Team, TeamMember } from '../types';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    filterTeams();
  }, [teams, searchQuery, statusFilter]);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      if (response.ok) {
        const result = await response.json();
        // Handle API response structure that includes success/data fields
        const teamsData = result.success ? (result.data || []) : (result || []);
        // Ensure teamsData is an array
        setTeams(Array.isArray(teamsData) ? teamsData : []);
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
        } else if (statusFilter === 'completed') {
          // Teams don't have "completed" status anymore, return empty results
          return false;
        }
        return true;
      });
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
        alert('Error creating team: ' + (errorResult.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Error creating team: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      <div className="teams-page">
        <div className="page-header">
          <div className="header-info">
            <h1 className="page-title">Teams</h1>
            <p className="page-description">Manage and organize your development teams</p>
          </div>
        </div>
        <div className="loading-state">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="page teams-page">
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Teams</h1>
          <p className="page-description">Manage and organize your development teams</p>
        </div>
        
        <button 
          className="primary-button"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="button-icon" />
          New Team
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="page-controls">
        <div className="search-control">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-control">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="teams-grid">
        {Array.isArray(filteredTeams) && filteredTeams.map((team) => (
          <TeamCard 
            key={team.id} 
            team={team} 
            onClick={() => handleTeamClick(team)}
            onMemberClick={(member) => handleMemberClick(member, team.id)}
          />
        ))}
        <CreateCard
          title="Create New Team"
          onClick={() => setIsModalOpen(true)}
        />
      </div>

      {filteredTeams.length === 0 && !loading && (
        <div className="empty-state">
          <h3>No teams found</h3>
          <p>
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first team to get started'}
          </p>
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
    </div>
  );
};
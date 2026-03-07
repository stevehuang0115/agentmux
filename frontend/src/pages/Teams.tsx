import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Grid, List, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { useAlert } from '../components/UI/Dialog';
import TeamsGridCard from '@/components/Teams/TeamsGridCard';
import { TeamModal } from '../components/Modals/TeamModal';
import { TeamMemberModal } from '../components/Modals/TeamMemberModal';
import { Team, TeamMember, TeamMemberStatusChangeEvent } from '../types';
import TeamListItem from '@/components/Teams/TeamListItem';
import { apiService } from '@/services/api.service';
import { logSilentError } from '@/utils/error-handling';
import { webSocketService } from '../services/websocket.service';

/**
 * Organization group: a parent team with its child teams
 */
interface TeamOrganization {
  parent: Team;
  children: Team[];
}

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
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(new Set());

  /**
   * Group filtered teams into organizations (parent + children) and standalone teams.
   */
  const { organizations, standaloneTeams } = useMemo(() => {
    const orgs: TeamOrganization[] = [];
    const standalone: Team[] = [];

    // Build a set of all team IDs that are referenced as parents
    const parentIds = new Set<string>();
    for (const team of filteredTeams) {
      if (team.parentTeamId) {
        parentIds.add(team.parentTeamId);
      }
    }

    // Map of parentId -> child teams
    const childrenMap = new Map<string, Team[]>();
    const childTeamIds = new Set<string>();

    for (const team of filteredTeams) {
      if (team.parentTeamId) {
        childTeamIds.add(team.id);
        const existing = childrenMap.get(team.parentTeamId) || [];
        existing.push(team);
        childrenMap.set(team.parentTeamId, existing);
      }
    }

    for (const team of filteredTeams) {
      // Skip child teams (they'll be shown under their parent)
      if (childTeamIds.has(team.id)) continue;

      const children = childrenMap.get(team.id);
      if (children && children.length > 0) {
        // This is a parent/organization team
        orgs.push({ parent: team, children });
      } else {
        // Standalone team (not a parent, not a child)
        standalone.push(team);
      }
    }

    return { organizations: orgs, standaloneTeams: standalone };
  }, [filteredTeams]);

  /**
   * Toggle collapse state of an organization group
   */
  const toggleOrgCollapse = (orgId: string) => {
    setCollapsedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  /**
   * Handle team member status change event from WebSocket.
   * Updates the team member's agentStatus in the teams list.
   */
  const handleTeamMemberStatusChange = useCallback((data: TeamMemberStatusChangeEvent) => {
    setTeams(prevTeams =>
      prevTeams.map(team => {
        if (team.id === data.teamId) {
          return {
            ...team,
            members: team.members.map(member => {
              if (member.id === data.memberId || member.sessionName === data.sessionName) {
                return { ...member, agentStatus: data.agentStatus };
              }
              return member;
            }),
          };
        }
        return team;
      })
    );
  }, []);

  useEffect(() => {
    fetchTeams();
    loadProjectsForFilter();
  }, []);

  /**
   * Subscribe to WebSocket events for real-time status updates.
   */
  useEffect(() => {
    webSocketService.on('team_member_status_changed', handleTeamMemberStatusChange);

    return () => {
      webSocketService.off('team_member_status_changed', handleTeamMemberStatusChange);
    };
  }, [handleTeamMemberStatusChange]);

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
  }, [teams, searchQuery, statusFilter, projectFilter]);

  const fetchTeams = async () => {
    try {
      // Use cached apiService.getTeams() to reduce redundant API calls
      const teamsData = await apiService.getTeams();

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
        (team.projectIds?.length > 0 && team.projectIds.some(pid => pid.toLowerCase().includes(searchQuery.toLowerCase()))) ||
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
      filtered = filtered.filter(team => team.projectIds?.includes(projectFilter));
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

      {/* Organization groups */}
      {organizations.map(org => {
        const isCollapsed = collapsedOrgs.has(org.parent.id);
        const totalMembers = org.children.reduce((sum, t) => sum + (t.members?.length || 0), 0) + (org.parent.members?.length || 0);
        const activeChildCount = org.children.filter(t => t.members?.some(m => m.agentStatus === 'active')).length;

        return (
          <div key={org.parent.id} className="mb-8">
            {/* Organization header */}
            <div
              className="flex items-center gap-3 mb-4 cursor-pointer group"
              onClick={() => toggleOrgCollapse(org.parent.id)}
            >
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-text-primary-dark">{org.parent.name}</h3>
                  <span className="text-xs text-text-secondary-dark bg-surface-dark px-2 py-0.5 rounded-full">
                    {org.children.length} team{org.children.length !== 1 ? 's' : ''} &middot; {totalMembers} member{totalMembers !== 1 ? 's' : ''}
                  </span>
                  {activeChildCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-400">
                      {activeChildCount} active
                    </span>
                  )}
                </div>
                {org.parent.description && (
                  <p className="text-sm text-text-secondary-dark mt-0.5">{org.parent.description}</p>
                )}
              </div>
              <button className="p-1 text-text-secondary-dark group-hover:text-primary transition-colors">
                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            {/* Child teams */}
            {!isCollapsed && (
              <div className="ml-6 pl-4 border-l-2 border-primary/20">
                {view === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {org.children.map(team => (
                      <TeamsGridCard
                        key={team.id}
                        team={team}
                        projectName={team.projectIds?.length > 0 ? projectMap[team.projectIds[0]] : undefined}
                        onClick={() => handleTeamClick(team)}
                        onViewTeam={(teamId) => navigate(`/teams/${teamId}`)}
                        onEditTeam={(teamId) => navigate(`/teams/${teamId}?edit=true`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {org.children.map(team => (
                      <TeamListItem
                        key={team.id}
                        team={team}
                        projectName={team.projectIds?.length > 0 ? projectMap[team.projectIds[0]] : undefined}
                        onClick={() => handleTeamClick(team)}
                        onViewTeam={(teamId) => navigate(`/teams/${teamId}`)}
                        onEditTeam={(teamId) => navigate(`/teams/${teamId}?edit=true`)}
                        onDeleteTeam={async (teamId) => {
                          if (window.confirm('Are you sure you want to delete this team?')) {
                            try {
                              await apiService.deleteTeam(teamId);
                              setTeams(prev => prev.filter(t => t.id !== teamId));
                            } catch (error) {
                              showError('Failed to delete team: ' + (error instanceof Error ? error.message : 'Unknown error'));
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Standalone teams (no parent, no children) */}
      {standaloneTeams.length > 0 && (
        <>
          {organizations.length > 0 && (
            <div className="flex items-center gap-2 mb-4 mt-2">
              <h3 className="text-lg font-semibold text-text-primary-dark">Independent Teams</h3>
              <span className="text-xs text-text-secondary-dark bg-surface-dark px-2 py-0.5 rounded-full">
                {standaloneTeams.length}
              </span>
            </div>
          )}
          {view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {standaloneTeams.map(team => (
                <TeamsGridCard
                  key={team.id}
                  team={team}
                  projectName={team.projectIds?.length > 0 ? projectMap[team.projectIds[0]] : undefined}
                  onClick={() => handleTeamClick(team)}
                  onViewTeam={(teamId) => navigate(`/teams/${teamId}`)}
                  onEditTeam={(teamId) => navigate(`/teams/${teamId}?edit=true`)}
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
              {standaloneTeams.map(team => (
                <TeamListItem
                  key={team.id}
                  team={team}
                  projectName={team.projectIds?.length > 0 ? projectMap[team.projectIds[0]] : undefined}
                  onClick={() => handleTeamClick(team)}
                  onViewTeam={(teamId) => navigate(`/teams/${teamId}`)}
                  onEditTeam={(teamId) => navigate(`/teams/${teamId}?edit=true`)}
                  onDeleteTeam={async (teamId) => {
                    if (window.confirm('Are you sure you want to delete this team?')) {
                      try {
                        await apiService.deleteTeam(teamId);
                        setTeams(prev => prev.filter(t => t.id !== teamId));
                      } catch (error) {
                        showError('Failed to delete team: ' + (error instanceof Error ? error.message : 'Unknown error'));
                      }
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
        </>
      )}

      {/* Create team button when only org groups exist */}
      {standaloneTeams.length === 0 && organizations.length > 0 && (
        <div className="mt-4">
          {view === 'grid' ? (
            <div
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center p-5 rounded-xl border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary"
            >
              <Plus className="mr-2 w-4 h-4" />
              <span>Create New Team</span>
            </div>
          ) : (
            <div
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary"
            >
              <Plus className="mr-2 w-4 h-4" />
              <span>Create New Team</span>
            </div>
          )}
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

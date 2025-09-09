import React from 'react';
import { FolderOpen, Users, User, Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { EnhancedTeamMember } from './types';
import { Project, Team } from '../../types';

interface EnhancedAssignmentsListProps {
  projects: Project[];
  teams: Team[];
  enhancedMembers: EnhancedTeamMember[];
  onMemberClick: (memberId: string, memberName: string, teamId: string) => void;
}

interface ProjectWithTeamMembers {
  project: Project;
  teamMembers: EnhancedTeamMember[];
}

export const EnhancedAssignmentsList: React.FC<EnhancedAssignmentsListProps> = ({
  projects,
  teams,
  enhancedMembers,
  onMemberClick
}) => {
  // Group members by project
  const projectsWithMembers: ProjectWithTeamMembers[] = projects
    .filter(project => teams.some(team => team.currentProject === project.id))
    .map(project => {
      const teamMembers = enhancedMembers.filter(member => {
        const team = teams.find(t => t.id === member.teamId);
        return team && team.currentProject === project.id;
      });
      return { project, teamMembers };
    })
    .filter(item => item.teamMembers.length > 0);

  const getStatusIcon = (member: EnhancedTeamMember) => {
    if (member.currentTask) {
      return <Activity className="status-icon active" size={16} />;
    } else if (member.agentStatus === 'active') {
      return <CheckCircle className="status-icon idle" size={16} />;
    } else {
      return <AlertCircle className="status-icon inactive" size={16} />;
    }
  };

  const getStatusText = (member: EnhancedTeamMember) => {
    if (member.currentTask) {
      return `Working on: ${member.currentTask.taskName}`;
    } else if (member.agentStatus === 'active') {
      return 'Idle';
    } else {
      return 'Inactive';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (projectsWithMembers.length === 0) {
    return (
      <div className="empty-state">
        <FolderOpen size={48} className="empty-icon" />
        <h3>No Active Project Assignments</h3>
        <p>No teams have been assigned to projects with active members yet.</p>
      </div>
    );
  }

  return (
    <div className="enhanced-assignments-list">
      {projectsWithMembers.map(({ project, teamMembers }) => {
        // Group team members by team
        const teamGroups = teamMembers.reduce((groups, member) => {
          if (!groups[member.teamId]) {
            groups[member.teamId] = {
              teamName: member.teamName,
              members: []
            };
          }
          groups[member.teamId].members.push(member);
          return groups;
        }, {} as Record<string, { teamName: string; members: EnhancedTeamMember[] }>);

        return (
          <div key={project.id} className="enhanced-project-card">
            <div className="project-header">
              <FolderOpen size={20} />
              <h2>{project.name}</h2>
              <span className="project-status">{project.status}</span>
            </div>
            
            {Object.entries(teamGroups).map(([teamId, teamGroup]) => (
              <div key={teamId} className="team-section">
                <div className="team-header">
                  <Users size={18} />
                  <h3>{teamGroup.teamName}</h3>
                  <span className="member-count">
                    {teamGroup.members.length} member{teamGroup.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="members-list">
                  {teamGroup.members.map((member) => (
                    <div 
                      key={member.memberId} 
                      className={`member-item ${member.agentStatus} ${member.currentTask ? 'has-task' : 'idle'}`}
                      onClick={() => onMemberClick(member.memberId, member.memberName, member.teamId)}
                    >
                      <div className="member-info">
                        <div className="member-header">
                          <User size={16} />
                          <span className="member-name">{member.memberName}</span>
                          <span className="member-role">({member.role})</span>
                          {getStatusIcon(member)}
                        </div>
                        
                        <div className="member-status">
                          <span className="status-text">{getStatusText(member)}</span>
                          {member.currentTask && (
                            <div className="task-details">
                              <Clock size={12} />
                              <span className="task-time">
                                Started {formatTimeAgo(member.currentTask.assignedAt)}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {member.lastActivityCheck && (
                          <div className="activity-info">
                            <span className="last-check">
                              Last checked: {formatTimeAgo(member.lastActivityCheck)}
                            </span>
                            {member.activityDetected && (
                              <span className="activity-indicator">• Active</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {member.error && (
                        <div className="member-error">
                          <AlertCircle size={14} />
                          <span>{member.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
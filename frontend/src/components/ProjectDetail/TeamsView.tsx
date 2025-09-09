import React from 'react';
import { UserMinus } from 'lucide-react';
import { Team } from '../../types';
import { TeamsViewProps } from './types';

const TeamsView: React.FC<TeamsViewProps> = ({ 
  assignedTeams, 
  onUnassignTeam, 
  openTerminalWithSession 
}) => {
  return (
    <div className="teams-view">
      <div className="teams-header">
        <h3>Assigned Teams</h3>
        <p className="teams-description">
          Teams currently working on this project
        </p>
      </div>
      
      {assignedTeams.length > 0 ? (
        <div className="assigned-teams-grid">
          {assignedTeams.map((team) => (
            <div key={team.id} className="assigned-team-card">
              <div className="team-header">
                <div className="team-info">
                  <h4 className="team-name">{team.name}</h4>
                  <span className={`status-badge status-${team.members.some(m => m.agentStatus === 'active') ? 'active' : 'inactive'}`}>
                    {team.members.some(m => m.agentStatus === 'active') ? 'active' : 'inactive'}
                  </span>
                </div>
                <button
                  className="unassign-btn"
                  onClick={() => onUnassignTeam(team.id, team.name)}
                  title={`Unassign ${team.name} from project`}
                >
                  <UserMinus className="button-icon" />
                  Unassign
                </button>
              </div>
              
              {team.members && team.members.length > 0 && (
                <div className="team-members">
                  <h5 className="members-title">Members ({team.members.length})</h5>
                  <div className="members-list">
                    {team.members.map((member) => (
                      <div 
                        key={member.id} 
                        className="member-item"
                        onClick={() => {
                          // Use member.name as fallback if sessionName is not available
                          const sessionName = member.sessionName || member.name;
                          console.log('Member clicked:', member.name, 'using session:', sessionName);
                          openTerminalWithSession(sessionName);
                        }}
                        title={member.sessionName ? `Click to open terminal session: ${member.sessionName}` : 'No session available'}
                      >
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-role">{member.role}</span>
                        </div>
                        <div className="member-status">
                          <div className={`status-dot status-dot--${member.agentStatus}`} />
                          <span className="status-text">{member.agentStatus}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="team-meta">
                <div className="meta-item">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Last Activity:</span>
                  <span className="meta-value">
                    {new Date(team.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-teams">
          <div className="empty-icon">👥</div>
          <h4 className="empty-title">No teams assigned</h4>
          <p className="empty-description">
            Assign teams to this project to start collaborative development.
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamsView;
export { TeamsView };
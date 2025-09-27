import React, { useState } from 'react';
import { User, Edit2, Trash2, Save, X, Play, Square } from 'lucide-react';
import { TeamMember } from '../types/index';
import { useTerminal } from '../contexts/TerminalContext';

interface TeamMemberCardProps {
  member: TeamMember;
  onUpdate: (memberId: string, updates: Partial<TeamMember>) => void;
  onDelete: (memberId: string) => void;
  onStart?: (memberId: string) => Promise<void>;
  onStop?: (memberId: string) => Promise<void>;
  teamId?: string;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ 
  member, 
  onUpdate, 
  onDelete,
  onStart,
  onStop,
  teamId
}) => {
  const { openTerminalWithSession } = useTerminal();
  const [isEditing, setIsEditing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [editForm, setEditForm] = useState({
    name: member.name,
    role: member.role,
    runtimeType: member.runtimeType || 'claude-code'
  });

  const handleEdit = () => {
    setEditForm({
      name: member.name,
      role: member.role,
      runtimeType: member.runtimeType || 'claude-code'
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(member.id, editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm({
      name: member.name,
      role: member.role,
      runtimeType: member.runtimeType || 'claude-code'
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to remove ${member.name} from the team?`)) {
      onDelete(member.id);
    }
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onStart || !teamId) return;
    
    if (window.confirm(`Start ${member.name}?\n\nThis will:\n• Create a tmux session for this team member\n• Initialize Claude Code in the session\n• Set member status to "activating"`)) {
      setIsStarting(true);
      try {
        await onStart(member.id);
      } finally {
        setIsStarting(false);
      }
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onStop || !teamId) return;
    
    if (window.confirm(`Stop ${member.name}?\n\nThis will:\n• Terminate the tmux session\n• Set member status to "idle"`)) {
      setIsStopping(true);
      try {
        await onStop(member.id);
      } finally {
        setIsStopping(false);
      }
    }
  };

  const getOverallStatus = () => {
    const agentStatus = member.agentStatus;
    const workingStatus = member.workingStatus;
    
    // ACTIVATING - blue
    if (agentStatus === 'activating') {
      return {
        status: 'ACTIVATING', 
        color: '#3b82f6',
        shouldAnimate: false
      };
    }
    
    // ACTIVE and IN_PROGRESS - green flashing
    if (agentStatus === 'active' && workingStatus === 'in_progress') {
      return {
        status: 'RUNNING',
        color: '#10b981',
        shouldAnimate: true
      };
    }
    
    // ACTIVE but IDLE - green static
    if (agentStatus === 'active' && (workingStatus === 'idle' || !workingStatus)) {
      return {
        status: 'IDLE',
        color: '#10b981',
        shouldAnimate: false
      };
    }
    
    // INACTIVE (inactive status or no session) - grey
    if (agentStatus === 'inactive' || !member.sessionName) {
      return {
        status: 'INACTIVE',
        color: '#9ca3af',
        shouldAnimate: false
      };
    }
    
    // Default fallback
    return {
      status: 'INACTIVE',
      color: '#9ca3af',
      shouldAnimate: false
    };
  };

  const handleMemberClick = () => {
    if (member.sessionName && !isEditing) {
      console.log('TeamMemberCard: Opening terminal for session:', member.sessionName);
      openTerminalWithSession(member.sessionName);
    }
  };

  const getSessionStatusIcon = (sessionName?: string) => {
    return sessionName ? '🟢' : '⚪';
  };

  const getSessionStatusTitle = (sessionName?: string) => {
    if (sessionName) {
      return `tmux session active: ${sessionName} - Click to open terminal`;
    }
    return 'No tmux session';
  };

  const isClickable = member.sessionName && !isEditing;
  
  // Show Stop button when member is activating or active (priority over start button)
  const shouldShowStopButton = 
    onStop && 
    teamId && 
    (member.agentStatus === 'activating' || member.agentStatus === 'active') && 
    !isEditing;

  // Show Start button for inactive agents (but not if stop button should show)
  const shouldShowStartButton = 
    onStart && 
    teamId && 
    !shouldShowStopButton && 
    (member.agentStatus === 'inactive' || (!member.sessionName && member.agentStatus !== 'activating')) && 
    !isEditing;

  return (
    <div 
      className={`team-member-card ${isClickable ? 'clickable' : ''}`}
      onClick={handleMemberClick}
      style={{ 
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
      title={isClickable ? getSessionStatusTitle(member.sessionName) : undefined}
    >
      <div className="member-header">
        <div className="member-avatar">
          {member.avatar ? (
            member.avatar.startsWith('http') || member.avatar.startsWith('data:') ? (
              <img src={member.avatar} alt={member.name} style={{ width: 20, height: 20, borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: 14 }}>{member.avatar}</span>
            )
          ) : (
            <User size={20} />
          )}
        </div>
        <div className="member-basic-info">
          {isEditing ? (
            <div className="edit-form">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="member-name-input"
                placeholder="Member name"
              />
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as TeamMember['role'] })}
                className="member-role-input"
              >
                <option value="">Select a role...</option>
                <option value="orchestrator">Orchestrator</option>
                <option value="tpm">Technical Product Manager</option>
                <option value="pgm">Program Manager</option>
                <option value="developer">Developer</option>
                <option value="frontend-developer">Frontend Developer</option>
                <option value="backend-developer">Backend Developer</option>
                <option value="qa">QA Engineer</option>
                <option value="tester">Test Engineer</option>
                <option value="designer">Designer</option>
              </select>
              <select
                value={editForm.runtimeType}
                onChange={(e) => setEditForm({ ...editForm, runtimeType: e.target.value as TeamMember['runtimeType'] })}
                className="member-runtime-input"
                title="Select the AI runtime for this team member"
              >
                <option value="claude-code">Claude Code</option>
                <option value="gemini-cli">Gemini CLI</option>
                <option value="codex-cli">Codex CLI</option>
              </select>
            </div>
          ) : (
            <>
              <h4 className="member-name">{member.name}</h4>
              <p className="member-role">{member.role}</p>
            </>
          )}
        </div>
        <div className="member-actions">
          {isEditing ? (
            <div className="edit-actions">
              <button 
                onClick={handleSave}
                className="action-btn save-btn"
                title="Save changes"
              >
                <Save size={16} />
              </button>
              <button 
                onClick={handleCancel}
                className="action-btn cancel-btn"
                title="Cancel editing"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="member-controls">
              {shouldShowStartButton && (
                <button 
                  onClick={handleStart}
                  className="action-btn start-btn"
                  title="Start this team member"
                  disabled={isStarting}
                >
                  <Play size={16} />
                </button>
              )}
              {shouldShowStopButton && (
                <button 
                  onClick={handleStop}
                  className="action-btn stop-btn"
                  title="Stop this team member"
                  disabled={isStopping}
                >
                  <Square size={16} />
                </button>
              )}
              <button 
                onClick={handleEdit}
                className="action-btn edit-btn"
                title="Edit member"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={handleDelete}
                className="action-btn delete-btn"
                title="Remove member"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="member-details">
        <div className="member-status-row">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <div className="status-circle-container">
              <div 
                className={`status-circle ${getOverallStatus().shouldAnimate ? 'pulsing' : ''}`}
                style={{ 
                  backgroundColor: getOverallStatus().color,
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  display: 'inline-block',
                  marginRight: '6px',
                  animation: getOverallStatus().shouldAnimate ? 'pulse-status 2s infinite' : 'none'
                }}
              />
              <span className="status-text">{getOverallStatus().status}</span>
            </div>
          </div>
        </div>
        
        <div className="member-meta">
          <div className="meta-item">
            <span className="meta-label">Last Update:</span>
            <span className="meta-value">
              {new Date(member.updatedAt).toLocaleString()}
            </span>
          </div>
          {member.lastActivityCheck && (
            <div className="meta-item">
              <span className="meta-label">Activity Check:</span>
              <span className="meta-value">
                {new Date(member.lastActivityCheck).toLocaleString()}
              </span>
            </div>
          )}
          {member.sessionName && (
            <div className="meta-item">
              <span className="meta-label">Session:</span>
              <code className="session-name">{member.sessionName}</code>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">Runtime:</span>
            <span className="meta-value runtime-type">
              {member.runtimeType ? member.runtimeType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Claude Code'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

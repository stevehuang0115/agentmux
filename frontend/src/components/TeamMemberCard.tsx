import React, { useState } from 'react';
import { User, Edit2, Trash2, Save, X } from 'lucide-react';
import { TeamMember } from '../types/index';
import { useTerminal } from '../contexts/TerminalContext';

interface TeamMemberCardProps {
  member: TeamMember;
  onUpdate: (memberId: string, updates: Partial<TeamMember>) => void;
  onDelete: (memberId: string) => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ 
  member, 
  onUpdate, 
  onDelete 
}) => {
  const { openTerminalWithSession } = useTerminal();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: member.name,
    role: member.role
  });

  const handleEdit = () => {
    setEditForm({
      name: member.name,
      role: member.role
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
      role: member.role
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to remove ${member.name} from the team?`)) {
      onDelete(member.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return '#10b981'; // green
      case 'idle': return '#f59e0b'; // amber
      case 'error': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
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
          <User size={20} />
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
              <input
                type="text"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as TeamMember['role'] })}
                className="member-role-input"
                placeholder="Member role"
              />
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
            <span 
              className="status-badge"
              style={{ 
                backgroundColor: getStatusColor(member.status),
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              {member.status}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Session:</span>
            <div 
              className={`session-indicator ${member.sessionName ? 'active' : 'inactive'}`}
              title={getSessionStatusTitle(member.sessionName)}
            >
              <div className="session-dot"></div>
              {member.sessionName && <span className="session-label">Active</span>}
            </div>
          </div>
        </div>
        
        <div className="member-meta">
          <div className="meta-item">
            <span className="meta-label">Last Activity:</span>
            <span className="meta-value">
              {new Date(member.updatedAt).toLocaleString()}
            </span>
          </div>
          {member.sessionName && (
            <div className="meta-item">
              <span className="meta-label">Session:</span>
              <code className="session-name">{member.sessionName}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
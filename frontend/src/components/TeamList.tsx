import React from 'react';
import { useConfirm, useAlert } from './UI/Dialog';
import { Team, TeamMember } from '@/types';
import { 
  UserGroupIcon, 
  ComputerDesktopIcon, 
  ExclamationTriangleIcon,
  XCircleIcon,
  PlayCircleIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface TeamListProps {
  teams: Team[];
  onMemberSelect?: (member: TeamMember) => void;
  onTeamTerminate?: (teamId: string) => void;
  className?: string;
}

const agentStatusIcons = {
  inactive: XCircleIcon,
  activating: PlayCircleIcon,
  active: ComputerDesktopIcon,
};

const agentStatusColors = {
  inactive: 'text-gray-500 bg-gray-100',
  activating: 'text-yellow-600 bg-yellow-100',
  active: 'text-green-600 bg-green-100',
};

const workingStatusColors = {
  idle: 'text-gray-500 bg-gray-100',
  in_progress: 'text-green-600 bg-green-100',
};

const roleColors = {
  orchestrator: 'bg-purple-100 text-purple-800',
  pm: 'bg-blue-100 text-blue-800',
  developer: 'bg-green-100 text-green-800',
  qa: 'bg-orange-100 text-orange-800',
  tester: 'bg-indigo-100 text-indigo-800',
  designer: 'bg-pink-100 text-pink-800',
};

export const TeamList: React.FC<TeamListProps> = ({
  teams,
  onMemberSelect,
  onTeamTerminate,
  className = '',
}) => {
  const { showConfirm, ConfirmComponent } = useConfirm();
  const { showError, AlertComponent } = useAlert();
  const handleTerminate = (teamId: string, teamName: string) => {
    if (confirm(`Are you sure you want to terminate team "${teamName}"? This will stop all Claude Code sessions.`)) {
      onTeamTerminate?.(teamId);
    }
  };

  if (teams.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="text-center py-8">
          <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No teams</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first team.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <UserGroupIcon className="h-6 w-6 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Teams ({teams.length})</h3>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {teams.map((team) => {
          return (
            <div key={team.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full text-blue-600 bg-blue-100">
                    <UserGroupIcon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-lg font-medium text-gray-900 truncate">
                        {team.name}
                      </h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                        {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {team.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {team.description}
                      </p>
                    )}
                    
                    {team.currentProject && (
                      <p className="text-xs text-gray-500">
                        Project: {team.currentProject}
                      </p>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-1">
                      Updated: {new Date(team.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {onTeamTerminate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTerminate(team.id, team.name);
                      }}
                      className="text-red-600 hover:text-red-800 text-xs px-2 py-1 hover:bg-red-50 rounded"
                    >
                      Terminate
                    </button>
                  )}
                </div>
              </div>

              {/* Team Members */}
              <div className="ml-13">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  Team Members ({team.members.length})
                </h5>
                <div className="space-y-2">
                  {team.members.map((member) => {
                    const MemberStatusIcon = agentStatusIcons[member.agentStatus];
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => onMemberSelect?.(member)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={clsx(
                            'flex items-center justify-center w-8 h-8 rounded-full',
                            agentStatusColors[member.agentStatus]
                          )}>
                            <MemberStatusIcon className="h-4 w-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {member.name}
                              </span>
                              <span className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                roleColors[member.role]
                              )}>
                                {member.role}
                              </span>
                            </div>
                            
                            <p className="text-xs text-gray-500">
                              Session: <code className="bg-gray-200 px-1 rounded text-xs">{member.sessionName}</code>
                            </p>
                            
                            {member.currentTickets && member.currentTickets.length > 0 && (
                              <p className="text-xs text-gray-500">
                                Tickets: {member.currentTickets.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-1">
                          <span className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                            agentStatusColors[member.agentStatus]
                          )}>
                            {member.agentStatus}
                          </span>
                          <span className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                            workingStatusColors[member.workingStatus]
                          )}>
                            {member.workingStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <AlertComponent />
    <ConfirmComponent />
    </>
  );
};
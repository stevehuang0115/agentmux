
import React, { useState, useRef, useEffect } from 'react';
import { TeamMember, TeamMemberStatus } from '../../types';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
import { EditTeamMemberModal } from '../Modals/EditTeamMemberModal';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';

interface TeamMemberCardProps {
  member: TeamMember;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ member }) => {
  const isStarted = member.status === TeamMemberStatus.Started;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="bg-surface-dark p-4 rounded-lg border border-border-dark flex items-center justify-between cursor-pointer hover:bg-background-dark hover:border-primary/50 transition-all group">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <img alt={`${member.name} Avatar`} className="w-12 h-12 rounded-full border-2 border-transparent group-hover:border-primary transition-colors" src={member.avatarUrl} />
            <img alt="Assistant Avatar" className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-surface-dark" src={member.assistantAvatarUrl} />
          </div>
          <div>
            <p className="font-semibold text-lg">{member.name}</p>
            <p className="text-sm text-text-secondary-dark">Session: <span className={isStarted ? "font-medium text-primary/80" : "font-medium text-text-secondary-dark/80"}>{member.session}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isStarted ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isStarted ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span>{member.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className={`w-9 h-9 ${isStarted ? 'hover:bg-red-500/20 hover:text-red-400' : 'hover:bg-green-500/20 hover:text-green-400'}`}>
              <Icon name={isStarted ? 'stop' : 'play_arrow'} />
            </Button>
            <div className="relative" ref={menuRef}>
              <Button size="icon" variant="ghost" onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-9 h-9 hover:bg-primary/20 hover:text-primary">
                <Icon name="more_vert" />
              </Button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-dark border border-border-dark rounded-lg shadow-lg z-10">
                    <ul className="py-1">
                        <li>
                            <button 
                                onClick={() => { setIsEditModalOpen(true); setIsMenuOpen(false); }} 
                                className="w-full text-left px-4 py-2 text-sm text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark flex items-center gap-3 transition-colors"
                            >
                                <Icon name="edit" className="text-base" />
                                <span>Edit Member</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                onClick={() => { alert('Delete member'); setIsMenuOpen(false); }} 
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                            >
                                <Icon name="delete" className="text-base" />
                                <span>Delete Member</span>
                            </button>
                        </li>
                    </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <EditTeamMemberModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} member={member} />
    </>
  );
};
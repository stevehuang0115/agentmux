
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { teams } from '../constants';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../components/UI/Icon';
import { TeamModal } from '../components/Modals/TeamModal';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../components/UI/Button';
import { TeamMemberCard } from '../components/TeamDetail/TeamMemberCard';

export const TeamDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const team = teams.find(t => t.id === id);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [isActive, setIsActive] = useState(team ? team.status === 'Active' : false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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

    if (!team) {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold">Team not found</h2>
                <Link to="/teams" className="text-primary hover:underline mt-4 inline-block">Back to Teams</Link>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 text-sm text-text-secondary-dark">
                            <Link to="/teams" className="hover:text-primary">Teams</Link>
                            <Icon name="chevron_right" className="text-base" />
                            <span className="text-text-primary-dark font-medium">{team.name}</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight mt-2">{team.name}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={() => setIsActive(!isActive)} 
                            variant={isActive ? 'danger' : 'primary'}
                            icon={isActive ? 'stop' : 'play_arrow'}
                        >
                            {isActive ? 'Stop Team' : 'Start Team'}
                        </Button>
                         
                        <div className="relative" ref={menuRef}>
                            <Button 
                                variant="secondary"
                                size="icon"
                                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                            >
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
                                                <span>Edit Team</span>
                                            </button>
                                        </li>
                                        <li>
                                            <button 
                                                onClick={() => { alert('Delete action triggered'); setIsMenuOpen(false); }} 
                                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                            >
                                                <Icon name="delete" className="text-base" />
                                                <span>Delete Team</span>
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="font-semibold text-lg text-text-primary-dark">Team Members ({team.members.length})</h3>
                        {team.members.map(member => (
                            <TeamMemberCard key={member.id} member={member} />
                        ))}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-surface-dark p-6 rounded-lg border border-border-dark">
                            <h3 className="font-semibold text-lg text-text-primary-dark mb-4">Assigned Project</h3>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <Icon name="folder_special" className="text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold">{team.assignedProject}</p>
                                    <p className="text-sm text-text-secondary-dark">Web App Redesign</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-surface-dark p-6 rounded-lg border border-border-dark">
                            <h3 className="font-semibold text-lg text-text-primary-dark mb-4">Recent Activity</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <Icon name="history" className="text-text-secondary-dark text-xl mt-0.5" />
                                    <div>
                                        <p className="text-sm">Agent Smith pushed 3 new commits.</p>
                                        <p className="text-xs text-text-secondary-dark">2 hours ago</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Icon name="task_alt" className="text-text-secondary-dark text-xl mt-0.5" />
                                    <div>
                                        <p className="text-sm">Team completed the 'Login Page' task.</p>
                                        <p className="text-xs text-text-secondary-dark">1 day ago</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Icon name="person_add" className="text-text-secondary-dark text-xl mt-0.5" />
                                    <div>
                                        <p className="text-sm">Agent Morpheus was added to the team.</p>
                                        <p className="text-xs text-text-secondary-dark">3 days ago</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <TeamModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} team={team} />
        </>
    );
};
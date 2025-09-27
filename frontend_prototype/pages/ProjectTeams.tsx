
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { projects } from '../constants';
// Fix: Correcting import path casing from 'cards' to 'Cards'
import { TeamCard } from '../components/Cards/TeamCard';
// Fix: Correcting import path casing from 'cards' to 'Cards'
import { CreateCard } from '../components/Cards/CreateCard';
import { AssignTeamModal } from '../components/Modals/AssignTeamModal';

export const ProjectTeams: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const project = projects.find(p => p.id === id);
    const [isAssignModalOpen, setAssignModalOpen] = useState(false);

    if (!project) {
        return <p>Project not found.</p>;
    }

    return (
        <>
            <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {project.teams.map(team => (
                        <TeamCard key={team.id} team={team} showMenu={false} />
                    ))}
                    <CreateCard label="Assign New Team" icon="group_add" onClick={() => setAssignModalOpen(true)} />
                </div>
            </div>
            <AssignTeamModal 
                isOpen={isAssignModalOpen} 
                onClose={() => setAssignModalOpen(false)} 
                project={project} 
            />
        </>
    );
};
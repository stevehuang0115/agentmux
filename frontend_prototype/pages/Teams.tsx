
import React, { useState } from 'react';
import { teams } from '../constants';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { TeamCard } from '../components/Cards/TeamCard';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { CreateCard } from '../components/Cards/CreateCard';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../components/UI/Icon';
import { TeamModal } from '../components/Modals/TeamModal';
import { TeamListItem } from '../components/Teams/TeamListItem';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../components/UI/Button';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Input } from '../components/UI/Input';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Select } from '../components/UI/Select';

export const Teams: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <>
      <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
              <div>
                  <h2 className="text-3xl font-bold tracking-tight">Teams</h2>
                  <p className="text-sm text-text-secondary-dark mt-1">Manage your AI agent teams and their assignments.</p>
              </div>
              <Button onClick={() => setIsModalOpen(true)} icon="add">
                  Create New Team
              </Button>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
            <div className="relative flex-grow w-full md:w-auto">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-dark" />
              <Input className="bg-surface-dark border-border-dark pl-10" placeholder="Search teams..." type="text"/>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-full md:w-48">
                <Select className="bg-surface-dark border-border-dark !py-2.5">
                  <option>Filter by project</option>
                  <option>Project Phoenix</option>
                  <option>Project Nova</option>
                  <option>Project Atlas</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setView('grid')}
                  variant="secondary"
                  size="icon"
                  className={`${view === 'grid' ? '!bg-primary/10 text-primary' : ''}`}
                >
                  <Icon name="grid_view" />
                </Button>
                <Button 
                  onClick={() => setView('list')}
                  variant="secondary"
                  size="icon"
                  className={`${view === 'list' ? '!bg-primary/10 text-primary' : ''}`}
                >
                  <Icon name="list" />
                </Button>
              </div>
            </div>
          </div>
        
          {view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => (
                    <TeamCard key={team.id} team={team} />
                ))}
                <CreateCard label="Create New Team" icon="group_add" onClick={() => setIsModalOpen(true)} />
            </div>
          ) : (
            <div className="space-y-4">
              {teams.map(team => (
                <TeamListItem key={team.id} team={team} />
              ))}
              <div 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary"
              >
                <Icon name="add" className="mr-2" />
                <span>Create New Team</span>
              </div>
            </div>
          )}

      </div>
      <TeamModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
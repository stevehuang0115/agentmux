
import React from 'react';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';

interface CreateCardProps {
  label: string;
  icon: string;
  onClick?: () => void;
}

export const CreateCard: React.FC<CreateCardProps> = ({ label, icon, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-center flex-col p-6 rounded-lg border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary h-full"
    >
      <Icon name={icon} className="text-4xl" />
      <p className="mt-2 text-sm font-semibold">{label}</p>
    </div>
  );
};
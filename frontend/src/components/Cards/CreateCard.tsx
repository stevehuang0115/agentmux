import React from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

interface CreateCardProps {
  title: string;
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export const CreateCard: React.FC<CreateCardProps> = ({
  title,
  icon = <Plus className="create-icon" />,
  onClick,
  className
}) => {
  return (
    <div 
      className={clsx('create-card', className)}
      onClick={onClick}
    >
      <div className="create-content">
        <div className="create-icon-wrapper">
          {icon}
        </div>
        <h3 className="create-title">{title}</h3>
      </div>
    </div>
  );
};
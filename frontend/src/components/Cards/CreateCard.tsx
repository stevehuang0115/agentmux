import React from 'react';
import { Plus } from 'lucide-react';

interface CreateCardProps {
  title: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const CreateCard: React.FC<CreateCardProps> = ({
  title,
  icon = <Plus className="text-4xl" />,
  onClick,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-center flex-col p-6 rounded-lg border-2 border-dashed border-border-dark hover:border-primary transition-colors cursor-pointer text-text-secondary-dark hover:text-primary h-full ${className}`}
    >
      {icon}
      <p className="mt-2 text-sm font-semibold">{title}</p>
    </div>
  );
};
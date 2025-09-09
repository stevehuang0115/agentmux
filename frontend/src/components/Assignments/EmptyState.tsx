import React from 'react';
import { EmptyStateProps } from './types';

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  icon: Icon,
  title,
  description,
}) => {
  return (
    <div className="empty-state">
      <Icon size={48} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
};
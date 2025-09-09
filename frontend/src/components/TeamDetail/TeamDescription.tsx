import React from 'react';
import { TeamDescriptionProps } from './types';

export const TeamDescription: React.FC<TeamDescriptionProps> = ({ description }) => {
  if (!description) {
    return null;
  }

  return (
    <div className="team-description">
      <h3>Description</h3>
      <p>{description}</p>
    </div>
  );
};
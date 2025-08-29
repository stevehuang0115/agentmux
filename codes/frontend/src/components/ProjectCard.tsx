'use client';

import React, { useState } from 'react';
import { Project, ProjectStatus } from '../types/agentmux';
import { useAgentMux } from '../context/AgentMuxContext';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const { updateProject, deleteProject, assignments, teams } = useAgentMux();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editPath, setEditPath] = useState(project.fsPath);

  // Find assignment and team for this project
  const assignment = assignments.find(a => a.projectId === project.id && a.status === 'active');
  const assignedTeam = assignment ? teams.find(t => t.id === assignment.teamId) : null;

  // Status styling
  const getStatusStyle = (status: ProjectStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    
    await updateProject(project.id, {
      name: editName.trim(),
      fsPath: editPath.trim(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(project.name);
    setEditPath(project.fsPath);
    setIsEditing(false);
  };

  const handleArchive = async () => {
    if (confirm(`Archive project "${project.name}"?`)) {
      await updateProject(project.id, { status: 'archived' });
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      await deleteProject(project.id);
    }
  };

  return (
    <div 
      className="project-card bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4"
      data-testid={`project-${project.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full font-semibold text-lg text-gray-900 border-b border-blue-300 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          ) : (
            <h3 className="font-semibold text-lg text-gray-900 truncate">
              {project.name}
            </h3>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-blue-600 p-1"
              title="Edit project"
            >
              ✏️
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(project.status)}`}
          data-testid={`project-${project.id}-status`}
        >
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </span>

        {assignedTeam && (
          <span className="text-sm text-blue-600 font-medium">
            Team: {assignedTeam.name}
          </span>
        )}
      </div>

      {/* File Path */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Path</label>
        {isEditing ? (
          <input
            type="text"
            value={editPath}
            onChange={(e) => setEditPath(e.target.value)}
            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="text-sm text-gray-700 bg-gray-50 rounded px-2 py-1 truncate font-mono">
            {project.fsPath}
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-500 mb-4">
        <div>Created: {new Date(project.createdAt).toLocaleDateString()}</div>
        {project.lastActivity && (
          <div>Last active: {new Date(project.lastActivity).toLocaleString()}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {isEditing ? (
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={!editName.trim()}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-300 text-gray-700 px-3 py-1 text-sm rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={() => {/* TODO: Open spec editor */}}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Edit Specs
            </button>
            
            {!assignedTeam && (
              <button
                onClick={() => {/* TODO: Open assignment dialog */}}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                Assign Team
              </button>
            )}
          </div>
        )}

        <div className="flex space-x-2">
          {!isEditing && project.status !== 'archived' && (
            <button
              onClick={handleArchive}
              className="text-gray-500 hover:text-yellow-600 text-sm"
              title="Archive project"
            >
              📦
            </button>
          )}
          
          {!isEditing && (
            <button
              onClick={handleDelete}
              className="text-gray-500 hover:text-red-600 text-sm"
              title="Delete project"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
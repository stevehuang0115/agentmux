'use client';

import React, { useState } from 'react';
import { Project, Team, Assignment } from '../types/agentmux';
import { useAgentMux } from '../context/AgentMuxContext';

interface AssignmentBoardProps {
  projects: Project[];
  teams: Team[];
  assignments: Assignment[];
}

interface AssignmentCell {
  projectId: string;
  teamId: string;
  assignment?: Assignment;
}

export const AssignmentBoard: React.FC<AssignmentBoardProps> = ({
  projects,
  teams,
  assignments
}) => {
  const { createAssignment, updateAssignment, deleteAssignment } = useAgentMux();
  const [draggedTeam, setDraggedTeam] = useState<Team | null>(null);
  const [showConfirm, setShowConfirm] = useState<AssignmentCell | null>(null);

  // Create assignment grid
  const getAssignmentGrid = (): AssignmentCell[][] => {
    return projects.map(project => 
      teams.map(team => {
        const assignment = assignments.find(
          a => a.projectId === project.id && a.teamId === team.id && a.status === 'active'
        );
        return {
          projectId: project.id,
          teamId: team.id,
          assignment
        };
      })
    );
  };

  const grid = getAssignmentGrid();

  const handleCellClick = (cell: AssignmentCell) => {
    if (cell.assignment) {
      // Show assignment actions menu
      setShowConfirm(cell);
    } else {
      // Check if team is already assigned
      const existingAssignment = assignments.find(
        a => a.teamId === cell.teamId && a.status === 'active'
      );
      
      if (existingAssignment) {
        setShowConfirm(cell);
      } else {
        // Create assignment directly
        createAssignment(cell.projectId, cell.teamId);
      }
    }
  };

  const handleDragStart = (team: Team) => {
    setDraggedTeam(team);
  };

  const handleDragEnd = () => {
    setDraggedTeam(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    
    if (draggedTeam) {
      const cell: AssignmentCell = {
        projectId,
        teamId: draggedTeam.id
      };
      
      // Check if team is already assigned
      const existingAssignment = assignments.find(
        a => a.teamId === draggedTeam.id && a.status === 'active'
      );
      
      if (existingAssignment) {
        setShowConfirm(cell);
      } else {
        createAssignment(projectId, draggedTeam.id);
      }
    }
    
    setDraggedTeam(null);
  };

  const handleConfirmAssignment = async (cell: AssignmentCell) => {
    // End existing assignment if any
    const existingAssignment = assignments.find(
      a => a.teamId === cell.teamId && a.status === 'active'
    );
    
    if (existingAssignment) {
      await updateAssignment(existingAssignment.id, { 
        status: 'ended', 
        endedAt: new Date().toISOString() 
      });
    }
    
    // Create new assignment
    await createAssignment(cell.projectId, cell.teamId);
    setShowConfirm(null);
  };

  const handlePauseAssignment = async (assignment: Assignment) => {
    await updateAssignment(assignment.id, { status: 'paused' });
    setShowConfirm(null);
  };

  const handleResumeAssignment = async (assignment: Assignment) => {
    await updateAssignment(assignment.id, { status: 'active' });
    setShowConfirm(null);
  };

  const handleEndAssignment = async (assignment: Assignment) => {
    await updateAssignment(assignment.id, { 
      status: 'ended', 
      endedAt: new Date().toISOString() 
    });
    setShowConfirm(null);
  };

  const getAssignmentStatusStyle = (assignment: Assignment) => {
    switch (assignment.status) {
      case 'active':
        return 'bg-green-500 text-white';
      case 'paused':
        return 'bg-orange-500 text-white';
      case 'ended':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-300 text-gray-700';
    }
  };

  const getTeamDragStyle = (team: Team) => {
    const isAssigned = assignments.some(a => a.teamId === team.id && a.status === 'active');
    return `team-drag-item p-2 mb-2 bg-white border rounded cursor-move hover:shadow-md transition-shadow ${
      isAssigned ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
    }`;
  };

  if (projects.length === 0 && teams.length === 0) {
    return (
      <div className="assignment-board-empty text-center py-12">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No projects or teams yet</h3>
        <p className="text-gray-500">
          Create projects and teams first, then use the assignment board to connect them
        </p>
      </div>
    );
  }

  return (
    <div className="assignment-board">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Teams Column (Drag Source) */}
        <div className="teams-column">
          <h3 className="font-semibold text-gray-900 mb-4">Teams</h3>
          <div className="space-y-2">
            {teams.map(team => {
              const assignment = assignments.find(a => a.teamId === team.id && a.status === 'active');
              const project = assignment ? projects.find(p => p.id === assignment.projectId) : null;
              
              return (
                <div
                  key={team.id}
                  draggable
                  onDragStart={() => handleDragStart(team)}
                  onDragEnd={handleDragEnd}
                  className={getTeamDragStyle(team)}
                  data-testid={`team-${team.id}`}
                >
                  <div className="font-medium text-sm">{team.name}</div>
                  <div className="text-xs text-gray-500">
                    {team.roles.length} roles
                  </div>
                  {project && (
                    <div className="text-xs text-blue-600 mt-1">
                      → {project.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignment Grid */}
        <div className="assignment-grid lg:col-span-3">
          <h3 className="font-semibold text-gray-900 mb-4">
            Assignment Grid
            <span className="text-sm font-normal text-gray-500 ml-2">
              (Click cells to assign, or drag teams to projects)
            </span>
          </h3>

          {projects.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No projects available. Create a project first.
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((project, projectIndex) => (
                <div
                  key={project.id}
                  className="project-row border border-gray-200 rounded-lg p-4"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, project.id)}
                  data-testid={`project-${project.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{project.name}</h4>
                      <div className="text-sm text-gray-500">{project.fsPath}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {grid[projectIndex]?.map(cell => {
                      const team = teams.find(t => t.id === cell.teamId);
                      if (!team) return null;

                      return (
                        <button
                          key={`${cell.projectId}-${cell.teamId}`}
                          onClick={() => handleCellClick(cell)}
                          className={`assignment-cell p-3 border border-gray-200 rounded text-sm transition-colors ${
                            cell.assignment 
                              ? `${getAssignmentStatusStyle(cell.assignment)} hover:opacity-90`
                              : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-300'
                          }`}
                          data-testid={`assignment-cell-${cell.projectId}-${cell.teamId}`}
                        >
                          {cell.assignment ? (
                            <div>
                              <div className="font-medium">Assigned</div>
                              <div className="text-xs opacity-90">
                                {cell.assignment.status}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500">
                              Click to assign
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Assignment Action</h3>
            
            {showConfirm.assignment ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Team is currently assigned to this project. What would you like to do?
                </p>
                <div className="flex flex-col space-y-2">
                  {showConfirm.assignment.status === 'active' ? (
                    <button
                      onClick={() => handlePauseAssignment(showConfirm.assignment!)}
                      className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                    >
                      Pause Assignment
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResumeAssignment(showConfirm.assignment!)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Resume Assignment
                    </button>
                  )}
                  <button
                    onClick={() => handleEndAssignment(showConfirm.assignment!)}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    End Assignment
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Team may already be assigned to another project. Proceed with new assignment?
                </p>
                <button
                  onClick={() => handleConfirmAssignment(showConfirm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
                >
                  Confirm Assignment
                </button>
              </div>
            )}
            
            <button
              onClick={() => setShowConfirm(null)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 ml-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
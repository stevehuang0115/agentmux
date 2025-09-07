import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus, Play, FolderOpen, CheckSquare, FileText, Plus, Trash2, UserMinus, Info, ExternalLink, Square, RotateCcw } from 'lucide-react';
import { Project, Team, Ticket } from '../types';
import { apiService } from '../services/api.service';
import { TeamAssignmentModal } from '../components/Modals/TeamAssignmentModal';
import { MarkdownEditor } from '../components/MarkdownEditor/MarkdownEditor';
import { BuildSpecsSteps } from '../components/BuildSpecsSteps';
import { BuildTasksSteps } from '../components/BuildTasksSteps';
import { useTerminal } from '../contexts/TerminalContext';
import { Button, useAlert, useConfirm, Dropdown, FormPopup, FormGroup, FormRow, FormLabel, FormInput, FormTextarea, FormHelp } from '../components/UI';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  icon: string;
  children?: FileTreeNode[];
}

interface ProjectDetailState {
  project: Project | null;
  assignedTeams: Team[];
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
}

interface AlignmentStatus {
  hasAlignmentIssues: boolean;
  alignmentFilePath: string | null;
  content: string | null;
}

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { openTerminalWithSession } = useTerminal();
  const { showAlert, showSuccess, showError, AlertComponent } = useAlert();
  const { showConfirm, showDeleteConfirm, ConfirmComponent } = useConfirm();
  const [activeTab, setActiveTab] = useState<'detail' | 'editor' | 'tasks' | 'teams'>('detail');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isTeamAssignmentModalOpen, setIsTeamAssignmentModalOpen] = useState(false);
  const [isMarkdownEditorOpen, setIsMarkdownEditorOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isUserJourneyModalOpen, setIsUserJourneyModalOpen] = useState(false);
  const [goalContent, setGoalContent] = useState('');
  const [userJourneyContent, setUserJourneyContent] = useState('');
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<any>(null);
  const [taskAssignmentLoading, setTaskAssignmentLoading] = useState<string | null>(null);
  const [buildSpecsWorkflow, setBuildSpecsWorkflow] = useState<{
    isActive: boolean;
    steps: Array<{
      id: number;
      name: string;
      delayMinutes: number;
      status: 'pending' | 'scheduled' | 'completed';
      scheduledAt?: Date;
    }>;
  }>({
    isActive: false,
    steps: []
  });
  const [state, setState] = useState<ProjectDetailState>({
    project: null,
    assignedTeams: [],
    tickets: [],
    loading: true,
    error: null
  });
  
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>({
    hasAlignmentIssues: false,
    alignmentFilePath: null,
    content: null
  });

  const [selectedBuildSpecsTeam, setSelectedBuildSpecsTeam] = useState<string>('');
  const [selectedBuildTasksTeam, setSelectedBuildTasksTeam] = useState<string>('');
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadProjectData(id);
    }
  }, [id]);

  // Refresh project data when Teams tab becomes active to show newly assigned teams
  useEffect(() => {
    if (id && activeTab === 'teams') {
      loadProjectData(id);
    }
  }, [activeTab, id]);

  const checkAlignmentStatus = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/alignment-status`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAlignmentStatus(result.data);
        }
      }
    } catch (error) {
      console.error('Failed to check alignment status:', error);
    }
  };

  const handleContinueWithMisalignment = async () => {
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/continue-with-misalignment`, {
        method: 'POST'
      });
      
      if (response.ok) {
        showSuccess('Orchestrator notified to continue Build Specs despite alignment issues');
        // Clear alignment issues since user decided to continue
        setAlignmentStatus({
          hasAlignmentIssues: false,
          alignmentFilePath: null,
          content: null
        });
      } else {
        showError('Failed to notify orchestrator');
      }
    } catch (error) {
      showError('Failed to continue with misalignment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleViewAlignment = async () => {
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=alignment_comparison.md`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Create a new window/tab to display the content
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head>
                  <title>Alignment Comparison Analysis</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                    h1, h2, h3 { color: #333; }
                    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
                    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
                  </style>
                </head>
                <body>
                  <h1>Codebase Alignment Analysis</h1>
                  <pre>${result.data.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </body>
              </html>
            `);
            newWindow.document.close();
          }
        }
      } else {
        showError('Failed to load alignment analysis');
      }
    } catch (error) {
      showError('Failed to view alignment analysis: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const loadProjectData = async (projectId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const [project, tasks] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getAllTasks(projectId)  // Load tasks from project-specific markdown files
      ]);
      
      // Get assigned teams based on project data
      const allTeams = await apiService.getTeams();
      const assignedTeams = allTeams.filter(team => {
        // More robust matching - handle both project ID and project name
        const matchesById = team.currentProject === projectId;
        const matchesByName = team.currentProject === project.name;
        
        // Debug logging to help troubleshoot
        if (team.currentProject) {
          console.log('Team assignment check:', {
            teamName: team.name,
            teamCurrentProject: team.currentProject,
            projectId,
            projectName: project.name,
            matchesById,
            matchesByName
          });
        }
        
        return matchesById || matchesByName;
      });
      
      // Set available teams for Build Specs dropdown
      setAvailableTeams(allTeams);
      
      setState({
        project,
        assignedTeams,
        tickets: tasks,  // Use tasks from markdown files
        loading: false,
        error: null
      });
      
      // Check alignment status after project data loads
      await checkAlignmentStatus(projectId);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load project'
      }));
    }
  };

  const handleAssignTeams = () => {
    setIsTeamAssignmentModalOpen(true);
  };

  const handleStartProject = async () => {
    if (!state.project || state.assignedTeams.length === 0) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Start the project with assigned teams
      const response = await apiService.startProject(state.project.id, state.assignedTeams.map(t => t.id));
      
      // Reload project data to reflect updated statuses
      await loadProjectData(state.project.id);
      
      // Show success message with details
      showSuccess(
        `${response.message || 'Project started with automated check-ins and git commit reminders.'}`,
        'Project Started Successfully'
      );
      
    } catch (error) {
      console.error('Failed to start project:', error);
      showError(
        'Failed to start project: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Start Project Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleStopProject = async () => {
    if (!state.project) return;
    
    showConfirm(
      `Are you sure you want to stop "${state.project.name}"?\n\nThis will:\n• Stop all scheduled check-ins and git reminders\n• Set project status to 'stopped'\n• Keep all teams and work intact\n\nYou can restart the project at any time.`,
      async () => await executeStopProject(),
      {
        title: 'Stop Project',
        confirmText: 'Stop Project',
        type: 'warning'
      }
    );
  };

  const executeStopProject = async () => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`/api/projects/${state.project.id}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reload project data to reflect updated status
        await loadProjectData(state.project.id);
        
        showSuccess(
          result.message || 'Project stopped successfully. Scheduled messages have been cancelled.',
          'Project Stopped'
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stop project');
      }
      
    } catch (error) {
      console.error('Failed to stop project:', error);
      showError(
        'Failed to stop project: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Stop Project Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Task interaction handlers
  const handleTaskClick = (task: any) => {
    setSelectedTaskForDetail(task);
    setIsTaskDetailModalOpen(true);
  };

  const handleTaskAssign = async (task: any) => {
    if (!state.project) return;
    
    try {
      setTaskAssignmentLoading(task.id);
      
      // Check if orchestrator session exists
      const response = await fetch(`/api/teams/activity-check`);
      if (!response.ok) {
        throw new Error('Failed to check orchestrator status');
      }
      
      const status = await response.json();
      if (!status.success || !status.data || !status.data.orchestrator || !status.data.orchestrator.running) {
        showError('Orchestrator session is not running. Please start the orchestrator first.', 'Assignment Failed');
        return;
      }

      // Assign task to orchestrator
      const assignResponse = await fetch(`/api/projects/${state.project.id}/assign-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: task.id,
          taskTitle: task.title,
          taskDescription: task.description,
          taskPriority: task.priority,
          taskMilestone: task.milestoneId,
          projectName: state.project.name,
          projectPath: state.project.path
        }),
      });

      if (assignResponse.ok) {
        const result = await assignResponse.json();
        showSuccess(
          `Task "${task.title}" has been assigned to the orchestrator team.`,
          'Task Assigned'
        );
      } else {
        const error = await assignResponse.json();
        throw new Error(error.error || 'Failed to assign task');
      }

    } catch (error) {
      console.error('Failed to assign task:', error);
      showError(
        'Failed to assign task: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Assignment Failed'
      );
    } finally {
      setTaskAssignmentLoading(null);
    }
  };

  const handleRestartProject = async () => {
    if (!state.project) return;
    
    showConfirm(
      `Restart "${state.project.name}"?\n\nThis will:\n• Restart scheduled check-ins and git reminders\n• Set project status to 'active'\n• Create new automated scheduling\n\nThis is useful if scheduled messages stopped working.`,
      async () => await executeRestartProject(),
      {
        title: 'Restart Project',
        confirmText: 'Restart Project',
        type: 'info'
      }
    );
  };

  const executeRestartProject = async () => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`/api/projects/${state.project.id}/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reload project data to reflect updated status
        await loadProjectData(state.project.id);
        
        showSuccess(
          result.message || 'Project restarted successfully with new scheduled messages.',
          'Project Restarted'
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restart project');
      }
      
    } catch (error) {
      console.error('Failed to restart project:', error);
      showError(
        'Failed to restart project: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Restart Project Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCreateSpecsTasks = async () => {
    if (!state.project) return;
    
    showConfirm(
      'Create Specs Tasks?\n\nThis will generate specification-focused tasks using the TPM role. The orchestrator will analyze project requirements and create detailed specification tasks.',
      async () => await executeCreateSpecsTasks(),
      {
        title: 'Create Specs Tasks',
        confirmText: 'Create Specs Tasks',
        type: 'info'
      }
    );
  };

  const executeCreateSpecsTasks = async () => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/tasks/create-from-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.project.id,
          configType: 'build_spec_prompt',
          targetRole: 'tpm'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reload project data to show new tasks
        await loadProjectData(state.project.id);
        
        showSuccess(
          result.message || 'Specs tasks created successfully! Tasks have been assigned to the orchestrator for TPM assignment.',
          'Specs Tasks Created'
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create specs tasks');
      }
      
    } catch (error) {
      console.error('Failed to create specs tasks:', error);
      showError(
        'Failed to create specs tasks: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Create Specs Tasks Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCreateDevTasks = async () => {
    if (!state.project) return;
    
    showConfirm(
      'Create Dev Tasks?\n\nThis will generate development-focused tasks using the dev role. The orchestrator will create detailed development and implementation tasks.',
      async () => await executeCreateDevTasks(),
      {
        title: 'Create Dev Tasks',
        confirmText: 'Create Dev Tasks',
        type: 'info'
      }
    );
  };

  const executeCreateDevTasks = async () => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/tasks/create-from-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.project.id,
          configType: 'build_tasks_prompt',
          targetRole: 'dev'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reload project data to show new tasks
        await loadProjectData(state.project.id);
        
        showSuccess(
          result.message || 'Dev tasks created successfully! Tasks have been assigned to the orchestrator for developer assignment.',
          'Dev Tasks Created'
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create dev tasks');
      }
      
    } catch (error) {
      console.error('Failed to create dev tasks:', error);
      showError(
        'Failed to create dev tasks: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Create Dev Tasks Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCreateE2ETasks = async () => {
    if (!state.project) return;
    
    showConfirm(
      'Create E2E Tasks?\n\nThis will generate end-to-end testing tasks using the QA role. The system will analyze your project type and create appropriate E2E testing tasks with technology recommendations.',
      async () => await executeCreateE2ETasks(),
      {
        title: 'Create E2E Tasks',
        confirmText: 'Create E2E Tasks',
        type: 'info'
      }
    );
  };

  const executeCreateE2ETasks = async () => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/tasks/create-from-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.project.id,
          configType: 'build_e2e_test_plan_prompt',
          targetRole: 'qa'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reload project data to show new tasks
        await loadProjectData(state.project.id);
        
        showSuccess(
          result.message || 'E2E tasks created successfully! Tasks have been assigned to the orchestrator for QA assignment.',
          'E2E Tasks Created'
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create E2E tasks');
      }
      
    } catch (error) {
      console.error('Failed to create E2E tasks:', error);
      showError(
        'Failed to create E2E tasks: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Create E2E Tasks Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleTeamAssignmentComplete = () => {
    // Reload project data to reflect new team assignments
    if (id) {
      loadProjectData(id);
    }
  };

  const handleUnassignTeam = (teamId: string, teamName: string) => {
    if (!state.project) return;
    
    showConfirm(
      `Are you sure you want to unassign "${teamName}" from this project?\n\nThis will send a command to the orchestrator to delete the team's tmux sessions.`,
      async () => await executeUnassignTeam(teamId, teamName),
      {
        title: 'Unassign Team',
        confirmText: 'Unassign Team',
        type: 'warning'
      }
    );
  };

  const executeUnassignTeam = async (teamId: string, teamName: string) => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Send unassign command to orchestrator to delete tmux sessions
      await fetch('/api/orchestrator/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: `unassign_team ${teamId} ${state.project.id}` 
        }),
      });
      
      // Unassign team from project
      await apiService.unassignTeamFromProject(state.project.id, teamId);
      
      // Reload project data to reflect changes
      await loadProjectData(state.project.id);
      
      showSuccess(
        `Team "${teamName}" has been unassigned from the project and their tmux sessions have been terminated.`,
        'Team Unassigned'
      );
      
    } catch (error) {
      console.error('Failed to unassign team:', error);
      showError(
        'Failed to unassign team: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Unassign Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteProject = () => {
    if (!state.project) return;
    
    showConfirm(
      `Are you sure you want to delete "${state.project.name}"?\n\nThis will:\n• Remove the project from AgentMux registry\n• Keep all project files and .agentmux folder intact\n• Unassign any active teams from this project\n\nThis action cannot be undone.`,
      async () => await executeDeleteProject(),
      {
        title: 'Delete Project',
        confirmText: 'Delete Project',
        type: 'error'
      }
    );
  };

  const executeDeleteProject = async () => {
    if (!state.project) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`/api/projects/${state.project.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        showSuccess(
          `Project deleted successfully!\n\n${result.message}`,
          'Project Deleted'
        );
        // Navigate back to projects list after a brief delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete project');
      }
      
    } catch (error) {
      console.error('Failed to delete project:', error);
      showError(
        'Failed to delete project: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Delete Failed'
      );
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Modal handlers for spec creation/editing
  const handleAddGoal = () => {
    setGoalContent('');
    setIsGoalModalOpen(true);
  };

  const handleEditGoal = async () => {
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=initial_goal.md`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setGoalContent(result.data.content);
          setIsGoalModalOpen(true);
        } else {
          throw new Error(result.error || 'Failed to load goal content');
        }
      } else {
        throw new Error('Failed to load goal content');
      }
    } catch (error) {
      console.error('Error loading goal content:', error);
      alert('❌ Failed to load goal content: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };
  
  const handleSaveGoal = async () => {
    if (!goalContent.trim()) {
      alert('Please enter project goal content');
      return;
    }
    
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/create-spec-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: 'initial_goal.md',
          content: goalContent
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsGoalModalOpen(false);
          setGoalContent('');
          showSuccess('Project goal saved successfully!', 'Goal Saved');
          // Reload project data to refresh the Detail view
          if (id) {
            loadProjectData(id);
          }
        } else {
          throw new Error(result.error || 'Failed to save goal');
        }
      } else {
        throw new Error('Failed to save goal');
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('Failed to save goal: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleAddUserJourney = () => {
    setUserJourneyContent('');
    setIsUserJourneyModalOpen(true);
  };

  const handleEditUserJourney = async () => {
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=initial_user_journey.md`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUserJourneyContent(result.data.content);
          setIsUserJourneyModalOpen(true);
        } else {
          throw new Error(result.error || 'Failed to load user journey content');
        }
      } else {
        throw new Error('Failed to load user journey content');
      }
    } catch (error) {
      console.error('Error loading user journey content:', error);
      alert('❌ Failed to load user journey content: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };
  
  const handleSaveUserJourney = async () => {
    if (!userJourneyContent.trim()) {
      alert('Please enter user journey content');
      return;
    }
    
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/create-spec-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: 'initial_user_journey.md',
          content: userJourneyContent
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsUserJourneyModalOpen(false);
          setUserJourneyContent('');
          showSuccess('User journey saved successfully!', 'User Journey Saved');
          // Reload project data to refresh the Detail view
          if (id) {
            loadProjectData(id);
          }
        } else {
          throw new Error(result.error || 'Failed to save user journey');
        }
      } else {
        throw new Error('Failed to save user journey');
      }
    } catch (error) {
      console.error('Error saving user journey:', error);
      alert('Failed to save user journey: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleBuildSpecs = async () => {
    if (!state.project) return;
    
    showConfirm(
      'This will create a Product Manager for this project and instruct them to build detailed specifications and task planning using a step-by-step process. Continue?',
      async () => await executeBuildSpecs(),
      {
        title: 'Build Specifications',
        confirmText: 'Start Build Process',
        type: 'info'
      }
    );
  };

  const handleOpenInFinder = async () => {
    if (!state.project) return;
    
    try {
      const response = await fetch(`/api/projects/${state.project.id}/open-finder`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to open Finder');
      }
      
      const result = await response.json();
      if (result.success) {
        // Show success message briefly
        showSuccess('Project folder opened in Finder', 'Finder Opened');
      } else {
        throw new Error(result.error || 'Failed to open Finder');
      }
    } catch (error) {
      console.error('Error opening Finder:', error);
      showError('Failed to open Finder: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleBuildTasks = async () => {
    if (!state.project) return;
    
    showConfirm(
      'This will generate detailed project tasks organized by milestone phases. The selected team member will analyze specifications and create milestone directories with detailed task files. Continue?',
      async () => await executeBuildTasks(),
      {
        title: 'Build Tasks',
        confirmText: 'Start Build Tasks',
        type: 'info'
      }
    );
  };

  const executeBuildTasks = async () => {
    if (!state.project) return;
    
    // Validate team selection
    if (!selectedBuildTasksTeam || selectedBuildTasksTeam === 'orchestrator') {
      showError('Please select a team member first. Build Tasks must be assigned to an existing team member.');
      return;
    }
    
    try {
      // Load the build tasks configuration
      const configResponse = await fetch('/api/build-tasks/config');
      if (!configResponse.ok) {
        throw new Error('Failed to load Build Tasks configuration');
      }
      const result = await configResponse.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Build Tasks configuration');
      }
      const config = result.data;

      // Get the initial goal and user journey content
      const [goalResponse, journeyResponse] = await Promise.all([
        fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=initial_goal.md`),
        fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=initial_user_journey.md`)
      ]);

      if (!goalResponse.ok || !journeyResponse.ok) {
        throw new Error('Failed to load initial specifications');
      }

      const [goalResult, journeyResult] = await Promise.all([
        goalResponse.json(),
        journeyResponse.json()
      ]);

      if (!goalResult.success || !journeyResult.success) {
        throw new Error('Failed to read initial specifications');
      }

      const initialGoal = goalResult.data.content;
      const userJourney = journeyResult.data.content;

      // Get the selected team and member information
      console.log('Using selected team member for Build Tasks:', selectedBuildTasksTeam);
      const [teamId, memberId] = selectedBuildTasksTeam.split(':');
      
      const selectedTeam = availableTeams.find(team => team.id === teamId);
      const selectedMember = selectedTeam?.members.find((m: any) => m.id === memberId);
      
      if (!selectedTeam || !selectedMember) {
        throw new Error('Selected team member not found');
      }
      
      console.log('Selected team:', selectedTeam.name, 'Member:', selectedMember.name);

      // Process workflow steps
      const steps = config.steps;

      // Get the actual session name for the selected member
      const targetSessionName = selectedMember.sessionName || selectedMember.name;
      console.log('Target session name for Build Tasks:', targetSessionName);

      // Send all steps as scheduled messages to the selected team member
      const stepPromises = [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        console.log(`Scheduling Build Tasks Step ${step.id}: ${step.name} with ${step.delayMinutes} minute delay...`);
        
        const promise = fetch('/api/build-tasks/retry-step', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: state.project!.id,
            stepId: step.id,
            targetSession: targetSessionName,
            projectName: state.project!.name,
            projectPath: state.project!.path,
            initialGoal,
            userJourney
          })
        });
        
        stepPromises.push(promise.then(async (response) => {
          if (response.ok) {
            const result = await response.json();
            console.log(`Build Tasks Step ${step.id} scheduled:`, result.message);
            return { stepId: step.id, success: true, message: result.message };
          } else {
            const error = await response.text();
            console.error(`Build Tasks Step ${step.id} failed:`, error);
            return { stepId: step.id, success: false, error };
          }
        }));
      }

      // Wait for all step requests to complete
      const responses = await Promise.all(stepPromises);
      
      // Check if all steps were successful
      const allSuccessful = responses.every(response => response.success);

      if (allSuccessful) {
        // Auto-expand terminal to show selected member's session
        openTerminalWithSession(targetSessionName);
        
        // Show success message
        const totalSteps = steps.length;
        const maxDelayMinutes = Math.max(...steps.map(s => s.delayMinutes));
        
        showSuccess(
          `Build Tasks process sent to ${selectedMember.name}!\n\n📋 ${totalSteps} steps sent to ${selectedTeam.name}\n⏱️ Final step in ${maxDelayMinutes} minutes\n\n🔍 Monitor ${selectedMember.name}'s terminal for progress.\n\nThis will create milestone directories and detailed task files in .agentmux/tasks/`,
          'Build Tasks Started'
        );
      } else {
        throw new Error('Some Build Tasks steps failed to schedule');
      }

    } catch (error) {
      console.error('Error building tasks:', error);
      showError('Failed to build tasks: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const executeBuildSpecs = async () => {
    if (!state.project) return;
    
    // Validate team selection
    if (!selectedBuildSpecsTeam || selectedBuildSpecsTeam === 'orchestrator') {
      showError('Please select a team member first. Build Specs must be assigned to an existing team member.');
      return;
    }
    
    // Find the selected team and member
    const selectedTeam = availableTeams.find(t => t.id === selectedBuildSpecsTeam);
    const selectedMember = selectedTeam?.members?.[0]; // For build specs, we use the first member
    
    // Validate that the team has been started (has session names)
    if (!selectedMember?.sessionName) {
      showError('Team must be started before using Build Specs. Please click "Start Team" first to create tmux sessions for team members.');
      return;
    }
    
    try {
      // Load the step-by-step build specs configuration
      const configResponse = await fetch('/api/build-specs/config');
      if (!configResponse.ok) {
        throw new Error('Failed to load Build Specs configuration');
      }
      const result = await configResponse.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Build Specs configuration');
      }
      const config = result.data;

      // Get the initial goal and user journey content
      const [goalResponse, journeyResponse] = await Promise.all([
        fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=initial_goal.md`),
        fetch(`/api/projects/${state.project.id}/spec-file-content?fileName=initial_user_journey.md`)
      ]);

      if (!goalResponse.ok || !journeyResponse.ok) {
        throw new Error('Failed to load initial specifications');
      }

      const [goalResult, journeyResult] = await Promise.all([
        goalResponse.json(),
        journeyResponse.json()
      ]);

      if (!goalResult.success || !journeyResult.success) {
        throw new Error('Failed to read initial specifications');
      }

      const initialGoal = goalResult.data.content;
      const userJourney = journeyResult.data.content;

      // Template substitution function
      const substituteTemplate = (prompts: string[]) => {
        return prompts.map(prompt => 
          prompt
            .replace(/\{PROJECT_NAME\}/g, state.project!.name)
            .replace(/\{PROJECT_PATH\}/g, state.project!.path)
            .replace(/\{PROJECT_ID\}/g, state.project!.id)
            .replace(/\{INITIAL_GOAL\}/g, initialGoal)
            .replace(/\{USER_JOURNEY\}/g, userJourney)
        ).join('\n');
      };

      // Get the selected team and member information
      console.log('Using selected team member:', selectedBuildSpecsTeam);
      const [teamId, memberId] = selectedBuildSpecsTeam.split(':');
      
      const selectedTeam = availableTeams.find(team => team.id === teamId);
      const selectedMember = selectedTeam?.members.find((m: any) => m.id === memberId);
      
      if (!selectedTeam || !selectedMember) {
        throw new Error('Selected team member not found');
      }
      
      console.log('Selected team:', selectedTeam.name, 'Member:', selectedMember.name);

      // Skip team assignment since we're using an existing team
      console.log('Using existing team - no assignment needed');

      // Step 3: Process workflow steps (now that team is created and assigned)
      const steps = config.steps;

      // Get the actual session name for the selected member
      const targetSessionName = selectedMember.sessionName || selectedMember.name;
      console.log('Target session name:', targetSessionName);

      // Send all steps as scheduled messages to the selected team member
      const stepPromises = [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        console.log(`Scheduling Step ${step.id}: ${step.name} with ${step.delayMinutes} minute delay...`);
        
        const promise = fetch('/api/build-specs/retry-step', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: state.project!.id,
            stepId: step.id,
            targetSession: targetSessionName,
            projectName: state.project!.name
          })
        });
        
        stepPromises.push(promise.then(async (response) => {
          if (response.ok) {
            const result = await response.json();
            console.log(`Step ${step.id} scheduled:`, result.message);
            return { stepId: step.id, success: true, message: result.message };
          } else {
            const error = await response.text();
            console.error(`Step ${step.id} failed:`, error);
            return { stepId: step.id, success: false, error };
          }
        }));
      }

      // Wait for all step requests to complete
      const responses = await Promise.all(stepPromises);
      
      // Check if all steps were successful
      const allSuccessful = await Promise.all(
        responses.map(async (response, index) => {
          const step = steps[index];
          
          if (step.delayMinutes === 0) {
            // For immediate steps, response is the combined message + enter response
            const result = await response;
            const messageOk = result.messageResponse.ok;
            const enterOk = result.enterResponse ? result.enterResponse.ok : true;
            
            if (messageOk && enterOk) {
              console.log(`Step ${step.id} (${step.name}) sent successfully with Enter key`);
              return true;
            } else {
              console.error(`Step ${step.id} (${step.name}) failed - Message: ${messageOk}, Enter: ${enterOk}`);
              return false;
            }
          } else {
            // For scheduled steps, response is the normal fetch response
            if (response.ok) {
              const result = await response.json();
              console.log(`Step ${step.id} (${step.name}) scheduled successfully:`, result);
              return true;
            } else {
              console.error(`Step ${step.id} (${step.name}) scheduling failed:`, response.status, response.statusText);
              try {
                const errorBody = await response.text();
                console.error(`Step ${step.id} error body:`, errorBody);
              } catch (e) {
                console.error(`Could not read error body for step ${step.id}`);
              }
              return false;
            }
          }
        })
      );

      if (allSuccessful.every(success => success)) {
        // Initialize workflow display
        const now = new Date();
        const workflowSteps = steps.map((step, index) => ({
          id: step.id,
          name: step.name,
          delayMinutes: step.delayMinutes,
          status: step.delayMinutes === 0 ? 'scheduled' as const : 'pending' as const,
          scheduledAt: step.delayMinutes === 0 ? now : new Date(now.getTime() + step.delayMinutes * 60000)
        }));

        setBuildSpecsWorkflow({
          isActive: true,
          steps: workflowSteps
        });

        // Auto-expand terminal to show selected member's session
        openTerminalWithSession(targetSessionName);
        
        // Show success message
        const totalSteps = steps.length;
        const maxDelayMinutes = Math.max(...steps.map(s => s.delayMinutes));
        
        showSuccess(
          `Build Specs process sent to ${selectedMember.name}!\n\n📋 ${totalSteps} steps sent to ${selectedTeam.name}\n⏱️ Final step in ${maxDelayMinutes} minutes\n\n🔍 Monitor ${selectedMember.name}'s terminal for progress.`,
          'Build Specs Started'
        );

        // Start a timer to update step statuses
        const updateTimer = setInterval(() => {
          setBuildSpecsWorkflow(current => {
            if (!current.isActive) return current;

            const now = new Date();
            const updatedSteps = current.steps.map(step => {
              if (step.status === 'pending' && step.scheduledAt && now >= step.scheduledAt) {
                return { ...step, status: 'scheduled' as const };
              }
              return step;
            });

            // Check if all steps are completed (this would need to be updated based on actual completion tracking)
            const allScheduled = updatedSteps.every(step => step.status === 'scheduled');
            if (allScheduled) {
              clearInterval(updateTimer);
              return {
                ...current,
                steps: updatedSteps
              };
            }

            return {
              ...current,
              steps: updatedSteps
            };
          });
        }, 30000); // Update every 30 seconds

        // Calculate total time for cleanup
        const totalTimeMinutes = steps.reduce((sum, step) => sum + step.delayMinutes, 0);
        
        // Clean up timer after workflow completion (estimated)
        setTimeout(() => {
          clearInterval(updateTimer);
        }, (totalTimeMinutes + 5) * 60000); // Cleanup 5 minutes after expected completion
      } else {
        throw new Error('Some Build Specs steps failed to schedule');
      }

    } catch (error) {
      console.error('Error building specs:', error);
      alert('❌ Failed to build specs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (state.loading) {
    return (
      <div className="project-detail-loading">
        <div className="loading-spinner" />
        <p>Loading project...</p>
      </div>
    );
  }

  if (state.error || !state.project) {
    return (
      <div className="project-detail-error">
        <h2>Error Loading Project</h2>
        <p>{state.error || 'Project not found'}</p>
      </div>
    );
  }

  const { project, assignedTeams, tickets } = state;

  return (
    <div className="project-detail">
      {/* Project Header */}
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">{project.name}</h1>
          <p className="page-description">
            {project.description || 'AgentMux project for collaborative development'}
            <br />
            <span className="project-path-with-action">
              <span className="project-path">
                <FolderOpen className="path-icon" />
                {project.path}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={handleOpenInFinder}
                title="Open project folder in Finder"
              >
                Open in Finder
              </Button>
            </span>
          </p>
        </div>
        
        <div className="header-controls">
          <span className={`status-badge status-${project.status}`}>
            {project.status}
          </span>
          <Button
            variant="secondary"
            icon={UserPlus}
            onClick={handleAssignTeams}
          >
            Assign Team
          </Button>
          
          {/* Project Lifecycle Controls */}
          {assignedTeams.length > 0 && (
            <>
              {project.status === 'active' ? (
                <>
                  <Button
                    variant="warning"
                    icon={Square}
                    onClick={handleStopProject}
                    disabled={state.loading}
                    title="Stop project and cancel scheduled messages"
                  >
                    Stop Project
                  </Button>
                  <Button
                    variant="secondary"
                    icon={RotateCcw}
                    onClick={handleRestartProject}
                    disabled={state.loading}
                    title="Restart project scheduling"
                  >
                    Restart
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  icon={Play}
                  onClick={handleStartProject}
                  disabled={state.loading}
                  loading={state.loading}
                >
                  {state.loading ? 'Starting...' : 'Start Project'}
                </Button>
              )}
            </>
          )}
          
          <Button
            variant="danger"
            icon={Trash2}
            onClick={handleDeleteProject}
            disabled={state.loading}
            title="Delete project from AgentMux (files will be kept)"
          >
            Delete
          </Button>
        </div>
      </div>


      {/* Tabs */}
      <div className="project-tabs">
        <button 
          className={`tab ${activeTab === 'detail' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('detail')}
        >
          <Info className="tab-icon" />
          Detail
        </button>
        <button 
          className={`tab ${activeTab === 'editor' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          <FolderOpen className="tab-icon" />
          Editor
        </button>
        <button 
          className={`tab ${activeTab === 'tasks' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckSquare className="tab-icon" />
          Tasks ({tickets.length})
        </button>
        <button 
          className={`tab ${activeTab === 'teams' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <UserPlus className="tab-icon" />
          Teams ({assignedTeams.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'detail' ? (
          <DetailView 
            project={project} 
            onAddGoal={handleAddGoal}
            onEditGoal={handleEditGoal}
            onAddUserJourney={handleAddUserJourney}
            onEditUserJourney={handleEditUserJourney}
            onBuildSpecs={handleBuildSpecs}
            onBuildTasks={handleBuildTasks}
            buildSpecsWorkflow={buildSpecsWorkflow}
            alignmentStatus={alignmentStatus}
            onContinueWithMisalignment={handleContinueWithMisalignment}
            onViewAlignment={handleViewAlignment}
            selectedBuildSpecsTeam={selectedBuildSpecsTeam}
            setSelectedBuildSpecsTeam={setSelectedBuildSpecsTeam}
            selectedBuildTasksTeam={selectedBuildTasksTeam}
            setSelectedBuildTasksTeam={setSelectedBuildTasksTeam}
            availableTeams={availableTeams}
            key={project.updatedAt} // Force re-render when project updates
          />
        ) : activeTab === 'editor' ? (
          <EditorView 
            project={project} 
            selectedFile={selectedFile} 
            onFileSelect={setSelectedFile}
            setIsMarkdownEditorOpen={setIsMarkdownEditorOpen}
          />
        ) : activeTab === 'tasks' ? (
          <TasksView 
            project={project} 
            tickets={tickets} 
            onTicketsUpdate={() => loadProjectData(project.id)}
            onCreateSpecsTasks={handleCreateSpecsTasks}
            onCreateDevTasks={handleCreateDevTasks}
            onCreateE2ETasks={handleCreateE2ETasks}
            loading={state.loading}
            onTaskClick={handleTaskClick}
            onTaskAssign={handleTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
        ) : (
          <TeamsView 
            assignedTeams={assignedTeams} 
            onUnassignTeam={handleUnassignTeam}
            openTerminalWithSession={openTerminalWithSession}
          />
        )}
      </div>

      {/* Team Assignment Modal */}
      {isTeamAssignmentModalOpen && (
        <TeamAssignmentModal
          project={project}
          onClose={() => setIsTeamAssignmentModalOpen(false)}
          onAssignmentComplete={handleTeamAssignmentComplete}
        />
      )}

      {/* Markdown Editor Modal */}
      {isMarkdownEditorOpen && (
        <MarkdownEditor
          projectPath={project.path}
          onClose={() => setIsMarkdownEditorOpen(false)}
        />
      )}

      {/* Task Detail Modal */}
      {isTaskDetailModalOpen && selectedTaskForDetail && (
        <FormPopup
          isOpen={isTaskDetailModalOpen}
          onClose={() => {
            setIsTaskDetailModalOpen(false);
            setSelectedTaskForDetail(null);
          }}
          title="Task Details"
          subtitle={`${selectedTaskForDetail.title} - Full Information`}
          onSubmit={(e) => { e.preventDefault(); }}
          submitText={null}
          cancelText="Close"
          size="lg"
        >
          <div className="task-detail-content">
            <FormGroup>
              <FormLabel>Task Title</FormLabel>
              <div className="task-detail-field">{selectedTaskForDetail.title}</div>
            </FormGroup>

            <FormGroup>
              <FormLabel>Description</FormLabel>
              <div className="task-detail-field task-detail-description">
                {selectedTaskForDetail.description || 'No description provided'}
              </div>
            </FormGroup>

            <FormRow>
              <FormGroup>
                <FormLabel>Priority</FormLabel>
                <div className={`task-detail-badge priority-badge priority-${selectedTaskForDetail.priority || 'medium'}`}>
                  {selectedTaskForDetail.priority || 'Medium'}
                </div>
              </FormGroup>
              
              <FormGroup>
                <FormLabel>Milestone</FormLabel>
                <div className="task-detail-badge milestone-badge">
                  {selectedTaskForDetail.milestoneId?.replace(/_/g, ' ').replace(/^m\d+\s*/, '') || 'General'}
                </div>
              </FormGroup>
            </FormRow>

            {selectedTaskForDetail.assignee && (
              <FormGroup>
                <FormLabel>Assignee</FormLabel>
                <div className="task-detail-badge assignee-badge">
                  {selectedTaskForDetail.assignee}
                </div>
              </FormGroup>
            )}

            {selectedTaskForDetail.tasks && selectedTaskForDetail.tasks.length > 0 && (
              <FormGroup>
                <FormLabel>Subtasks ({selectedTaskForDetail.tasks.length})</FormLabel>
                <div className="task-detail-subtasks">
                  {selectedTaskForDetail.tasks.map((subtask: string, index: number) => (
                    <div key={index} className="task-detail-subtask">
                      <span className="subtask-text">
                        {subtask.replace(/^\[x\]\s*|\[\s*\]\s*/i, '')}
                      </span>
                    </div>
                  ))}
                </div>
              </FormGroup>
            )}

            <div className="task-detail-actions">
              <Button
                variant="primary"
                icon={Play}
                onClick={() => {
                  handleTaskAssign(selectedTaskForDetail);
                  setIsTaskDetailModalOpen(false);
                  setSelectedTaskForDetail(null);
                }}
                disabled={taskAssignmentLoading === selectedTaskForDetail.id}
                loading={taskAssignmentLoading === selectedTaskForDetail.id}
              >
                {taskAssignmentLoading === selectedTaskForDetail.id ? 'Assigning...' : 'Assign to Team'}
              </Button>
            </div>
          </div>
        </FormPopup>
      )}

      {/* Goal Modal */}
      {isGoalModalOpen && (
        <FormPopup
          isOpen={isGoalModalOpen}
          onClose={() => setIsGoalModalOpen(false)}
          title="Add Project Goal"
          subtitle="Define your project's main objective and success criteria"
          onSubmit={(e) => { e.preventDefault(); handleSaveGoal(); }}
          submitText="Save Goal"
          size="md"
        >
          <FormGroup>
            <FormLabel htmlFor="goal-content" required>
              Project Goal
            </FormLabel>
            <FormTextarea
              id="goal-content"
              value={goalContent}
              onChange={(e) => setGoalContent(e.target.value)}
              placeholder="Describe your project's main objective, success criteria, and key outcomes..."
              rows={8}
              required
            />
            <FormHelp>
              Define what you want to achieve with this project. Be specific about goals, target users, and success metrics.
            </FormHelp>
          </FormGroup>
        </FormPopup>
      )}

      {/* User Journey Modal */}
      {isUserJourneyModalOpen && (
        <FormPopup
          isOpen={isUserJourneyModalOpen}
          onClose={() => setIsUserJourneyModalOpen(false)}
          title="Add User Journey"
          subtitle="Map out how users will interact with your solution"
          onSubmit={(e) => { e.preventDefault(); handleSaveUserJourney(); }}
          submitText="Save User Journey"
          size="md"
        >
          <FormGroup>
            <FormLabel htmlFor="journey-content" required>
              User Journey
            </FormLabel>
            <FormTextarea
              id="journey-content"
              value={userJourneyContent}
              onChange={(e) => setUserJourneyContent(e.target.value)}
              placeholder="Describe your users' journey from discovery to success. Include user personas, key interactions, pain points, and desired outcomes..."
              rows={8}
              required
            />
            <FormHelp>
              Map out how users will interact with your solution. Include user types, main flows, and critical touchpoints.
            </FormHelp>
          </FormGroup>
        </FormPopup>
      )}

      {/* Alert and Confirm Dialogs */}
      <AlertComponent />
      <ConfirmComponent />
    </div>
  );
};

// Detail Tab Component
const DetailView: React.FC<{
  project: Project;
  onAddGoal: () => void;
  onEditGoal: () => void;
  onAddUserJourney: () => void;
  onEditUserJourney: () => void;
  onBuildSpecs: () => void;
  onBuildTasks: () => void;
  buildSpecsWorkflow: {
    isActive: boolean;
    steps: Array<{
      id: number;
      name: string;
      delayMinutes: number;
      status: 'pending' | 'scheduled' | 'completed';
      scheduledAt?: Date;
    }>;
  };
  alignmentStatus: AlignmentStatus;
  onContinueWithMisalignment: () => void;
  onViewAlignment: () => void;
  selectedBuildSpecsTeam: string;
  setSelectedBuildSpecsTeam: (value: string) => void;
  selectedBuildTasksTeam: string;
  setSelectedBuildTasksTeam: (value: string) => void;
  availableTeams: any[];
}> = ({ project, onAddGoal, onEditGoal, onAddUserJourney, onEditUserJourney, onBuildSpecs, onBuildTasks, buildSpecsWorkflow, alignmentStatus, onContinueWithMisalignment, onViewAlignment, selectedBuildSpecsTeam, setSelectedBuildSpecsTeam, selectedBuildTasksTeam, setSelectedBuildTasksTeam, availableTeams }) => {
  const [projectStats, setProjectStats] = useState<{
    mdFileCount: number;
    taskCount: number;
    hasProjectMd: boolean;
    hasUserJourneyMd: boolean;
    hasInitialGoalMd: boolean;
    hasInitialUserJourneyMd: boolean;
  }>({
    mdFileCount: 0,
    taskCount: 0,
    hasProjectMd: false,
    hasUserJourneyMd: false,
    hasInitialGoalMd: false,
    hasInitialUserJourneyMd: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectStats();
  }, [project.id]);

  const loadProjectStats = async () => {
    try {
      setLoading(true);
      
      // Get project file stats
      const response = await fetch(`/api/projects/${project.id}/stats`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setProjectStats(result.data);
        }
      }
    } catch (error) {
      console.error('Error loading project stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInFinder = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/open-finder`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to open Finder');
      }
      
      const result = await response.json();
      if (result.success) {
        // Show success message briefly
        alert('✅ Project folder opened in Finder');
      } else {
        throw new Error(result.error || 'Failed to open Finder');
      }
    } catch (error) {
      console.error('Error opening Finder:', error);
      alert('❌ Failed to open Finder: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const hasInitialSpecs = () => {
    // Check if both initial_goal.md and initial_user_journey.md exist
    return projectStats.hasInitialGoalMd && projectStats.hasInitialUserJourneyMd;
  };

  const createSpecFile = async (fileName: string, content: string) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/create-spec-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          content
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`✅ ${fileName} created successfully!`);
          // Reload stats to reflect the new file
          loadProjectStats();
        } else {
          throw new Error(result.error || `Failed to create ${fileName}`);
        }
      } else {
        throw new Error(`Failed to create ${fileName}`);
      }
    } catch (error) {
      console.error(`Error creating ${fileName}:`, error);
      alert(`❌ Failed to create ${fileName}: ` + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getProjectTemplate = () => {
    return `# ${project.name}

## Project Goal

Describe the main objective and purpose of this project.

## Success Criteria

- [ ] Define specific, measurable outcomes
- [ ] Set clear acceptance criteria
- [ ] Establish timeline and milestones

## Technical Requirements

### Core Features
- Feature 1
- Feature 2
- Feature 3

### Technical Stack
- Frontend:
- Backend:
- Database:
- Other tools:

## Resources

- Documentation links
- Reference materials
- External dependencies
`;
  };

  const getUserJourneyTemplate = () => {
    return `# User Journey - ${project.name}

## User Persona

**Primary User**: [Describe the main user type]
- **Role**: 
- **Goals**: 
- **Pain Points**: 

## User Journey Map

### Phase 1: Discovery
**User Action**: 
**User Thoughts**: 
**Pain Points**: 
**Opportunities**: 

### Phase 2: Engagement
**User Action**: 
**User Thoughts**: 
**Pain Points**: 
**Opportunities**: 

### Phase 3: Conversion/Success
**User Action**: 
**User Thoughts**: 
**Pain Points**: 
**Opportunities**: 

## Key Touchpoints

1. **Entry Point**: How users discover the solution
2. **Core Interaction**: Main user flows and interactions
3. **Success State**: What success looks like for the user

## User Stories

- As a [user type], I want [goal] so that [benefit]
- As a [user type], I want [goal] so that [benefit]
- As a [user type], I want [goal] so that [benefit]
`;
  };

  const handleRetryBuildSpecStep = async (stepId: number) => {
    // Validate team selection
    if (!selectedBuildSpecsTeam || selectedBuildSpecsTeam === 'orchestrator') {
      console.error('No team member selected for step retry');
      return;
    }
    
    try {
      // Load the build specs configuration
      const configResponse = await fetch('/api/build-specs/config');
      if (!configResponse.ok) {
        throw new Error('Failed to load Build Specs configuration');
      }
      const result = await configResponse.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Build Specs configuration');
      }
      const config = result.data;

      // Find the specific step in the config
      const stepConfig = config.steps.find((s: any) => s.id === stepId);
      if (!stepConfig) {
        throw new Error(`Step ${stepId} not found in configuration`);
      }

      // Get the initial goal and user journey content
      const [goalResponse, journeyResponse] = await Promise.all([
        fetch(`/api/projects/${project.id}/spec-file-content?fileName=initial_goal.md`),
        fetch(`/api/projects/${project.id}/spec-file-content?fileName=initial_user_journey.md`)
      ]);

      if (!goalResponse.ok || !journeyResponse.ok) {
        throw new Error('Failed to load initial specifications');
      }

      const [goalResult, journeyResult] = await Promise.all([
        goalResponse.json(),
        journeyResponse.json()
      ]);

      if (!goalResult.success || !journeyResult.success) {
        throw new Error('Failed to read initial specifications');
      }

      const initialGoal = goalResult.data.content;
      const userJourney = journeyResult.data.content;

      // Get the selected team and member information
      const [teamId, memberId] = selectedBuildSpecsTeam.split(':');
      const selectedTeam = availableTeams.find(team => team.id === teamId);
      const selectedMember = selectedTeam?.members.find((m: any) => m.id === memberId);
      
      if (!selectedTeam || !selectedMember) {
        throw new Error('Selected team member not found');
      }

      // Get the actual session name for the selected member
      const targetSessionName = selectedMember.sessionName || selectedMember.name;
      
      console.log(`Retrying Build Spec Step ${stepId}: ${stepConfig.name} for ${selectedMember.name}`);

      // Template substitution function (same as in executeBuildSpecs)
      const substituteTemplate = (prompts: string[]) => {
        return prompts.map(prompt => 
          prompt
            .replace(/\{PROJECT_NAME\}/g, project.name)
            .replace(/\{PROJECT_PATH\}/g, project.path)
            .replace(/\{PROJECT_ID\}/g, project.id)
            .replace(/\{INITIAL_GOAL\}/g, initialGoal)
            .replace(/\{USER_JOURNEY\}/g, userJourney)
        ).join('\n');
      };

      // Process the single step using the same approach as executeBuildSpecs
      const processedPrompts = substituteTemplate(stepConfig.prompts);
      
      console.log(`Sending step ${stepId} prompts to ${targetSessionName}:`, processedPrompts.substring(0, 100) + '...');

      // Send the specific step to the selected team member using the same mechanism
      const promise = fetch('/api/build-specs/retry-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          stepId: stepId,
          targetSession: targetSessionName,
          projectName: project.name
        })
      });
      
      try {
        const response = await promise;
        if (response.ok) {
          const result = await response.json();
          console.log(`Step ${stepId} retry sent:`, result.message || 'Success');
          
          // Show a brief success message
          console.log(`✓ Retried step ${stepId} for ${selectedMember.name}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to retry step ${stepId}:`, errorText);
          
          // Fallback: if API doesn't exist (404), show that step retry is not available 
          if (response.status === 404) {
            console.log('Step retry API not available - backend support needed for individual step retry');
          }
        }
      } catch (networkError) {
        console.error('Network error retrying step:', networkError);
      }

    } catch (error) {
      console.error('Error retrying Build Spec step:', error);
    }
  };

  const handleRetryBuildTaskStep = async (stepId: number) => {
    // Validate team selection
    if (!selectedBuildTasksTeam || selectedBuildTasksTeam === 'orchestrator') {
      console.error('No team member selected for Build Tasks step retry');
      return;
    }
    
    try {
      // Load the build tasks configuration
      const configResponse = await fetch('/api/build-tasks/config');
      if (!configResponse.ok) {
        throw new Error('Failed to load Build Tasks configuration');
      }
      const result = await configResponse.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Build Tasks configuration');
      }
      const config = result.data;

      // Find the specific step in the config
      const stepConfig = config.steps.find((s: any) => s.id === stepId);
      if (!stepConfig) {
        throw new Error(`Step ${stepId} not found in configuration`);
      }

      // Get the initial goal and user journey content
      const [goalResponse, journeyResponse] = await Promise.all([
        fetch(`/api/projects/${project.id}/spec-file-content?fileName=initial_goal.md`),
        fetch(`/api/projects/${project.id}/spec-file-content?fileName=initial_user_journey.md`)
      ]);

      if (!goalResponse.ok || !journeyResponse.ok) {
        throw new Error('Failed to load initial specifications');
      }

      const [goalResult, journeyResult] = await Promise.all([
        goalResponse.json(),
        journeyResponse.json()
      ]);

      if (!goalResult.success || !journeyResult.success) {
        throw new Error('Failed to read initial specifications');
      }

      const initialGoal = goalResult.data.content;
      const userJourney = journeyResult.data.content;

      // Get the selected team and member information
      const [teamId, memberId] = selectedBuildTasksTeam.split(':');
      const selectedTeam = availableTeams.find(team => team.id === teamId);
      const selectedMember = selectedTeam?.members.find((m: any) => m.id === memberId);
      
      if (!selectedTeam || !selectedMember) {
        throw new Error('Selected team member not found');
      }

      // Get the actual session name for the selected member
      const targetSessionName = selectedMember.sessionName || selectedMember.name;
      
      console.log(`Retrying Build Tasks Step ${stepId}: ${stepConfig.name} for ${selectedMember.name}`);

      // Template substitution function (same as in executeBuildTasks)
      const substituteTemplate = (prompts: string[]) => {
        return prompts.map(prompt => 
          prompt
            .replace(/\{PROJECT_NAME\}/g, project.name)
            .replace(/\{PROJECT_PATH\}/g, project.path)
            .replace(/\{PROJECT_ID\}/g, project.id)
            .replace(/\{INITIAL_GOAL\}/g, initialGoal)
            .replace(/\{USER_JOURNEY\}/g, userJourney)
        ).join('\n');
      };

      // Process the single step using the same approach as executeBuildTasks
      const processedPrompts = substituteTemplate(stepConfig.prompts);
      
      console.log(`Sending Build Tasks step ${stepId} prompts to ${targetSessionName}:`, processedPrompts.substring(0, 100) + '...');

      // Send the specific step to the selected team member using the same mechanism
      const promise = fetch('/api/build-tasks/retry-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          stepId: stepId,
          targetSession: targetSessionName,
          projectName: project.name,
          projectPath: project.path,
          initialGoal,
          userJourney
        })
      });
      
      try {
        const response = await promise;
        if (response.ok) {
          const result = await response.json();
          console.log(`Build Tasks Step ${stepId} retry sent:`, result.message || 'Success');
          
          // Show a brief success message
          console.log(`✓ Retried Build Tasks step ${stepId} for ${selectedMember.name}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to retry Build Tasks step ${stepId}:`, errorText);
          
          // Fallback: if API doesn't exist (404), show that step retry is not available 
          if (response.status === 404) {
            console.log('Build Tasks step retry API not available - backend support needed for individual step retry');
          }
        }
      } catch (networkError) {
        console.error('Network error retrying Build Tasks step:', networkError);
      }

    } catch (error) {
      console.error('Error retrying Build Tasks step:', error);
    }
  };

  return (
    <div className="detail-view">
      <div className="detail-header">
        <h3>Project Details</h3>
        <p className="detail-description">
          Overview and key metrics for your project
        </p>
      </div>


      {/* Scorecards Section */}
      <div className="detail-section">
        <div className="section-header">
          <h4>Project Metrics</h4>
        </div>
        {loading ? (
          <div className="loading-stats">
            <p>Loading project metrics...</p>
          </div>
        ) : (
          <div className="scorecards-grid">
            <div className="scorecard">
              <div className="scorecard-header">
                <FileText className="scorecard-icon" />
                <h5>Specification Files</h5>
              </div>
              <div className="scorecard-value">{projectStats.mdFileCount}</div>
              <div className="scorecard-label">Markdown files in specs/</div>
            </div>
            <div className="scorecard">
              <div className="scorecard-header">
                <CheckSquare className="scorecard-icon" />
                <h5>Tasks Defined</h5>
              </div>
              <div className="scorecard-value">{projectStats.taskCount}</div>
              <div className="scorecard-label">Total project tasks</div>
            </div>
            <div className="scorecard">
              <div className="scorecard-header">
                <Info className="scorecard-icon" />
                <h5>Project Status</h5>
              </div>
              <div className="scorecard-value">
                <span className={`status-badge status-${project.status}`}>
                  {project.status}
                </span>
              </div>
              <div className="scorecard-label">Current state</div>
            </div>
          </div>
        )}
      </div>

      {/* Project Information Section */}
      <div className="detail-section">
        <div className="section-header">
          <h4>Project Information</h4>
        </div>
        <div className="project-info-grid">
          <div className="info-section">
            <h5>Name</h5>
            <p>{project.name}</p>
          </div>
          <div className="info-section">
            <h5>Path</h5>
            <p>{project.path}</p>
          </div>
          <div className="info-section">
            <h5>Status</h5>
            <p>
              <span className={`status-badge status-${project.status}`}>
                {project.status}
              </span>
            </p>
          </div>
          {project.description && (
            <div className="info-section">
              <h5>Description</h5>
              <p>{project.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Spec Files Management Section */}
      <div className="detail-section">
        <div className="section-header">
          <h4>Specification Management</h4>
        </div>
        <div className="spec-management">
          <div className="spec-status-grid">
            <div className="spec-status-item">
              <div className="spec-status-info">
                <FileText className="spec-icon" />
                <div className="spec-details">
                  <h5>Project Goal</h5>
                  <p className="spec-description">Define project objectives and success criteria</p>
                </div>
              </div>
              <div className="spec-status-indicator">
                {projectStats.hasInitialGoalMd ? (
                  <Button
                    variant="secondary"
                    icon={FileText}
                    onClick={onEditGoal}
                  >
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={onAddGoal}
                  >
                    Add Goal
                  </Button>
                )}
              </div>
            </div>
            
            <div className="spec-status-item">
              <div className="spec-status-info">
                <FileText className="spec-icon" />
                <div className="spec-details">
                  <h5>User Journey</h5>
                  <p className="spec-description">Map user interactions and experience flows</p>
                </div>
              </div>
              <div className="spec-status-indicator">
                {projectStats.hasInitialUserJourneyMd ? (
                  <Button
                    variant="secondary"
                    icon={FileText}
                    onClick={onEditUserJourney}
                  >
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={onAddUserJourney}
                  >
                    Add User Journey
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* Build Specs Button */}
          <div className="build-specs-section">
            {/* Team Selection Dropdown */}
            <div className="build-specs-controls">
              <div className="team-selector">
                <label htmlFor="build-specs-team" className="team-selector-label">
                  Select Team Member:
                </label>
                <Dropdown
                  id="build-specs-team"
                  className="team-selector-dropdown"
                  value={selectedBuildSpecsTeam}
                  onChange={setSelectedBuildSpecsTeam}
                  placeholder="Select a team member..."
                  options={availableTeams
                    .filter(team => team.members && team.members.length > 0)
                    .flatMap(team => 
                      team.members.map((member: any) => ({
                        value: `${team.id}:${member.id}`,
                        label: `${member.name} (${team.name})`
                      }))
                    )}
                />
              </div>
              
              <Button
                variant={hasInitialSpecs() && selectedBuildSpecsTeam ? 'success' : 'secondary'}
                icon={CheckSquare}
                onClick={hasInitialSpecs() && selectedBuildSpecsTeam ? onBuildSpecs : undefined}
                disabled={!hasInitialSpecs() || !selectedBuildSpecsTeam}
                title={
                  !hasInitialSpecs() 
                    ? 'Add both Goal and User Journey first' 
                    : !selectedBuildSpecsTeam 
                      ? 'Select a team member first'
                      : 'Send Build Specs workflow to selected team member'
                }
              >
                Build Specs
              </Button>
            </div>
            
            <p className="build-specs-description">
              {selectedBuildSpecsTeam
                ? 'Selected team member will receive Build Specs prompts to create detailed project specifications'
                : 'Select a team member to handle the Build Specs workflow - they will create specifications and task planning'
              }
            </p>
            
            {/* Alignment Issues Alert and Button */}
            {alignmentStatus.hasAlignmentIssues && (
              <div className="alignment-issues-alert">
                <div className="alert-content">
                  <div className="alert-header">
                    <span className="alert-icon">⚠️</span>
                    <h4>Codebase Alignment Issue Detected</h4>
                  </div>
                  <p className="alert-message">
                    The Product Manager found conflicts between your project goals/user journey and the existing codebase.
                  </p>
                  <div className="alignment-actions">
                    <Button
                      variant="warning"
                      icon={CheckSquare}
                      onClick={onContinueWithMisalignment}
                      title="Continue with Build Specs despite alignment issues"
                    >
                      Continue Anyway
                    </Button>
                    <Button
                      variant="secondary"
                      icon={FileText}
                      onClick={() => onViewAlignment()}
                      title="View detailed alignment analysis"
                    >
                      View Analysis
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Build Specs Steps UI - Always show when Build Specs is enabled */}
            {hasInitialSpecs() && (
              <BuildSpecsSteps 
                buildSpecsWorkflow={buildSpecsWorkflow}
                projectId={project.id}
                projectName={project.name}
                onRetryStep={(stepId: number) => {
                  // Implement step retry using the same mechanism as main Build Specs button
                  handleRetryBuildSpecStep(stepId);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Build Tasks Section */}
      <div className="detail-section">
        <div className="section-header">
          <h4>Build Tasks</h4>
        </div>
        <div className="build-tasks-section">
          <div className="build-specs-controls">
            <div className="team-selector">
              <label htmlFor="build-tasks-team" className="team-selector-label">
                Select Team Member:
              </label>
              <Dropdown
                id="build-tasks-team"
                className="team-selector-dropdown"
                value={selectedBuildTasksTeam}
                onChange={setSelectedBuildTasksTeam}
                placeholder="Select a team member..."
                options={availableTeams
                  .filter(team => team.members && team.members.length > 0)
                  .flatMap(team => 
                    team.members.map((member: any) => ({
                      value: `${team.id}:${member.id}`,
                      label: `${member.name} (${team.name})`
                    }))
                  )}
              />
            </div>
            
            <Button
              variant={hasInitialSpecs() && selectedBuildTasksTeam ? 'success' : 'secondary'}
              icon={CheckSquare}
              onClick={hasInitialSpecs() && selectedBuildTasksTeam ? onBuildTasks : undefined}
              disabled={!hasInitialSpecs() || !selectedBuildTasksTeam}
              title={
                !hasInitialSpecs() 
                  ? 'Build Specs must be completed first' 
                  : !selectedBuildTasksTeam 
                    ? 'Select a team member first'
                    : 'Send Build Tasks workflow to selected team member'
              }
            >
              Build Tasks
            </Button>
          </div>
          
          <p className="build-tasks-description">
            {selectedBuildTasksTeam
              ? 'Selected team member will receive Build Tasks prompts to create milestone phases and detailed task files'
              : 'Select a team member to handle the Build Tasks workflow - they will create milestone phases and detailed task files'
            }</p>
            
          <div className="build-tasks-steps">
            {project && (
              <BuildTasksSteps 
                projectId={project.id}
                projectName={project.name}
                onRetryStep={(stepId: number) => {
                  // Implement step retry using the same mechanism as main Build Tasks button
                  handleRetryBuildTaskStep(stepId);
                }}
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

// Editor Tab Component
const EditorView: React.FC<{
  project: Project;
  selectedFile: string | null;
  onFileSelect: (file: string | null) => void;
  setIsMarkdownEditorOpen: (open: boolean) => void;
}> = ({ project, selectedFile, onFileSelect, setIsMarkdownEditorOpen }) => {
  const [projectFiles, setProjectFiles] = useState<FileTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['.agentmux']));
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    loadProjectFiles();
  }, [project]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    } else {
      setFileContent('');
      setFileError(null);
    }
  }, [selectedFile, project]);

  const loadFileContent = async (filePath: string) => {
    try {
      setLoadingFile(true);
      setFileError(null);
      
      const response = await fetch(`/api/projects/${project.id}/file-content?filePath=${encodeURIComponent(filePath)}`);
      
      if (response.ok) {
        const result = await response.json();
        setFileContent(result.data.content);
      } else {
        const error = await response.json();
        setFileError(error.error || 'Failed to load file');
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      setFileError('Failed to load file content');
    } finally {
      setLoadingFile(false);
    }
  };

  const loadProjectFiles = async () => {
    try {
      console.log(`Loading files for project: ${project.name} at path: ${project.path}`);
      const response = await fetch(`/api/projects/${project.id}/files?depth=4&includeDotFiles=true`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.files) {
          console.log(`Loaded ${result.data.files.length} items from project directory:`);
          console.log(`Original path: ${result.data.projectPath}`);
          console.log(`Resolved path: ${result.data.resolvedPath}`);
          console.log('Files found:', result.data.files.map((f: any) => f.name).join(', '));
          setProjectFiles(result.data.files);
          
          // Auto-expand .agentmux folder if it exists
          const agentmuxExists = result.data.files.some((file: any) => file.name === '.agentmux');
          if (agentmuxExists) {
            setExpandedFolders(prev => new Set([...prev, '.agentmux']));
          }
        } else {
          console.error('Failed to load project files:', result.error);
          setProjectFiles([]);
        }
      } else {
        console.error('Error loading project files:', response.status);
        setProjectFiles([]);
      }
    } catch (error) {
      console.error('Error loading project files:', error);
      setProjectFiles([]);
    }
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  return (
    <div className="editor-view">
      {/* Left Panel - File Tree */}
      <div className="file-tree-panel">
        <div className="file-tree-header">
          <h3>Project Files</h3>
          <div className="project-path-display">
            <small title={project.path}>{project.path}</small>
          </div>
        </div>
        <div className="file-tree">
          <FileTreeView 
            files={projectFiles}
            selectedFile={selectedFile}
            expandedFolders={expandedFolders}
            onFileSelect={onFileSelect}
            onToggleFolder={toggleFolder}
          />
        </div>
      </div>

      {/* Right Panel - Editor/Info */}
      <div className="editor-panel">
        {selectedFile ? (
          <div className="file-viewer">
            <div className="file-header">
              <h3>{selectedFile}</h3>
            </div>
            <div className="file-content">
              {loadingFile ? (
                <div className="loading-state">
                  <p>Loading file content...</p>
                </div>
              ) : fileError ? (
                <div className="error-state">
                  <p>Error: {fileError}</p>
                </div>
              ) : (
                <pre className="code-viewer">
                  <code>{fileContent}</code>
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="project-info">
            <div className="info-header">
              <h3>Project Information</h3>
              <Button
                variant="primary"
                icon={FileText}
                onClick={() => setIsMarkdownEditorOpen(true)}
                title="Edit .agentmux spec files"
              >
                Edit Specs
              </Button>
            </div>
            
            <div className="info-section">
              <h4>Name</h4>
              <p>{project.name}</p>
            </div>
            <div className="info-section">
              <h4>Path</h4>
              <p>{project.path}</p>
            </div>
            <div className="info-section">
              <h4>Status</h4>
              <p>{project.status}</p>
            </div>
            {project.description && (
              <div className="info-section">
                <h4>Description</h4>
                <p>{project.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Tasks Tab Component  
const TasksView: React.FC<{
  project: Project;
  tickets: any[];  // Now contains tasks from markdown files
  onTicketsUpdate: () => void;
  onCreateSpecsTasks: () => void;
  onCreateDevTasks: () => void;
  onCreateE2ETasks: () => void;
  loading: boolean;
  onTaskClick: (task: any) => void;
  onTaskAssign: (task: any) => void;
  taskAssignmentLoading: string | null;
}> = ({ project, tickets, onTicketsUpdate, onCreateSpecsTasks, onCreateDevTasks, onCreateE2ETasks, loading, onTaskClick, onTaskAssign, taskAssignmentLoading }) => {
  
  // Group tasks by status for kanban board
  const tasksByStatus = {
    open: tickets.filter(t => t.status === 'open' || t.status === 'pending'),
    in_progress: tickets.filter(t => t.status === 'in_progress'),
    done: tickets.filter(t => t.status === 'done' || t.status === 'completed'),
    blocked: tickets.filter(t => t.status === 'blocked')
  };

  // Group tasks by milestone for milestone view
  const tasksByMilestone = tickets.reduce((acc, task) => {
    const milestone = task.milestone || task.milestoneId || 'Uncategorized';
    if (!acc[milestone]) {
      acc[milestone] = [];
    }
    acc[milestone].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="tasks-view">
      <div className="tasks-header">
        <div className="tasks-title-section">
          <h3>Project Tasks ({tickets.length})</h3>
          <div className="tasks-info">
            <span className="tasks-summary">
              {Object.keys(tasksByMilestone).length} Milestones • {tickets.length} Tasks
            </span>
          </div>
        </div>
        
        <div className="task-creation-controls">
          <Button
            variant="secondary"
            icon={FileText}
            onClick={onCreateSpecsTasks}
            disabled={loading}
            title="Create specification and requirements tasks for TPM role"
          >
            Create Specs Tasks
          </Button>
          <Button
            variant="secondary"
            icon={CheckSquare}
            onClick={onCreateDevTasks}
            disabled={loading}
            title="Create development and implementation tasks for dev role"
          >
            Create Dev Tasks
          </Button>
          <Button
            variant="secondary"
            icon={Play}
            onClick={onCreateE2ETasks}
            disabled={loading}
            title="Create end-to-end testing tasks with intelligent technology selection for QA role"
          >
            Create E2E Tasks
          </Button>
        </div>
      </div>
      
      {/* Milestone Overview */}
      <div className="milestones-section">
        <h4>Milestones Overview</h4>
        <div className="milestones-grid">
          {Object.entries(tasksByMilestone).map(([milestone, tasks]: [string, any[]]) => (
            <div key={milestone} className="milestone-card">
              <div className="milestone-header">
                <h5 className="milestone-title">
                  {milestone.replace(/_/g, ' ').replace(/^m\d+\s*/, '').replace(/^\w/, c => c.toUpperCase())}
                </h5>
                <span className="milestone-count">{tasks.length} tasks</span>
              </div>
              <div className="milestone-progress">
                <div className="progress-stats">
                  <span className="stat">
                    <span className="stat-value">{tasks.filter(t => t.status === 'done').length}</span>
                    <span className="stat-label">Done</span>
                  </span>
                  <span className="stat">
                    <span className="stat-value">{tasks.filter(t => t.status === 'in_progress').length}</span>
                    <span className="stat-label">In Progress</span>
                  </span>
                  <span className="stat">
                    <span className="stat-value">{tasks.filter(t => t.status === 'open' || t.status === 'pending').length}</span>
                    <span className="stat-label">Open</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="kanban-section">
        <h4>Task Board</h4>
        <div className="kanban-board">
          <TaskColumn
            title="Open"
            count={tasksByStatus.open.length}
            tasks={tasksByStatus.open}
            status="open"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
          <TaskColumn
            title="In Progress"
            count={tasksByStatus.in_progress.length}
            tasks={tasksByStatus.in_progress}
            status="in_progress"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
          <TaskColumn
            title="Done"
            count={tasksByStatus.done.length}
            tasks={tasksByStatus.done}
            status="done"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
          <TaskColumn
            title="Blocked"
            count={tasksByStatus.blocked.length}
            tasks={tasksByStatus.blocked}
            status="blocked"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
        </div>
      </div>
    </div>
  );
};

// Task Column Component for the new task system
const TaskColumn: React.FC<{
  title: string;
  count: number;
  tasks: any[];
  status: string;
  onTaskClick: (task: any) => void;
  onTaskAssign: (task: any) => void;
  taskAssignmentLoading: string | null;
}> = ({ title, count, tasks, status, onTaskClick, onTaskAssign, taskAssignmentLoading }) => {
  return (
    <div className={`task-column task-column--${status}`}>
      <div className="column-header">
        <h4 className="column-title">{title}</h4>
        <span className="task-count">{count}</span>
      </div>
      <div className="column-content">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className="task-card task-card-clickable" 
            onClick={() => onTaskClick(task)}
          >
            <div className="task-header">
              <h5 className="task-title">{task.title}</h5>
              <div className="task-actions">
                <button
                  className={`task-play-btn ${taskAssignmentLoading === task.id ? 'loading' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskAssign(task);
                  }}
                  disabled={taskAssignmentLoading === task.id}
                  title="Assign this task to the orchestrator team"
                >
                  {taskAssignmentLoading === task.id ? (
                    <div className="task-spinner" />
                  ) : (
                    <Play className="task-play-icon" />
                  )}
                </button>
                <div className="task-badges">
                  {task.priority && (
                    <span className={`priority-badge priority-${task.priority}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="task-description">{task.description}</p>
            
            <div className="task-meta">
              <div className="task-milestone">
                <span className="milestone-badge">
                  {task.milestoneId?.replace(/_/g, ' ').replace(/^m\d+\s*/, '') || 'General'}
                </span>
              </div>
              {task.assignee && (
                <div className="task-assignee">
                  <span className="assignee-badge">
                    {task.assignee}
                  </span>
                </div>
              )}
            </div>

            {task.tasks && task.tasks.length > 0 && (
              <div className="task-subtasks">
                <div className="subtasks-header">
                  <span className="subtasks-title">Tasks:</span>
                </div>
                <div className="subtasks-list">
                  {task.tasks.slice(0, 3).map((subtask: string, index: number) => (
                    <div key={index} className="subtask-item">
                      <span className="subtask-text">{subtask.replace(/^\[x\]\s*|\[\s*\]\s*/i, '')}</span>
                    </div>
                  ))}
                  {task.tasks.length > 3 && (
                    <div className="subtask-more">
                      +{task.tasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="empty-column">
            <div className="empty-icon">📋</div>
            <p>No {title.toLowerCase()} tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};

// File Tree View Component
const FileTreeView: React.FC<{
  files: FileTreeNode[];
  selectedFile: string | null;
  expandedFolders: Set<string>;
  onFileSelect: (path: string | null) => void;
  onToggleFolder: (path: string) => void;
  level?: number;
}> = ({ files, selectedFile, expandedFolders, onFileSelect, onToggleFolder, level = 0 }) => {
  return (
    <div>
      {files.map((file) => (
        <div key={file.path}>
          <div
            className={`file-item ${selectedFile === file.path ? 'file-item--selected' : ''}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (file.type === 'folder') {
                onToggleFolder(file.path);
              } else {
                onFileSelect(file.path);
              }
            }}
          >
            {file.type === 'folder' && (
              <span className="folder-toggle">
                {expandedFolders.has(file.path) ? '▼' : '▶'}
              </span>
            )}
            <span className="file-icon">{file.icon}</span>
            <span className="file-name">{file.name}</span>
          </div>
          
          {file.type === 'folder' && 
           expandedFolders.has(file.path) && 
           file.children && 
           file.children.length > 0 && (
            <FileTreeView
              files={file.children}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onFileSelect={onFileSelect}
              onToggleFolder={onToggleFolder}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// Teams Tab Component
const TeamsView: React.FC<{
  assignedTeams: Team[];
  onUnassignTeam: (teamId: string, teamName: string) => void;
  openTerminalWithSession: (sessionName: string) => void;
}> = ({ assignedTeams, onUnassignTeam, openTerminalWithSession }) => {
  return (
    <div className="teams-view">
      <div className="teams-header">
        <h3>Assigned Teams</h3>
        <p className="teams-description">
          Teams currently working on this project
        </p>
      </div>
      
      {assignedTeams.length > 0 ? (
        <div className="assigned-teams-grid">
          {assignedTeams.map((team) => (
            <div key={team.id} className="assigned-team-card">
              <div className="team-header">
                <div className="team-info">
                  <h4 className="team-name">{team.name}</h4>
                  <span className={`status-badge status-${team.status}`}>
                    {team.status}
                  </span>
                </div>
                <button
                  className="unassign-btn"
                  onClick={() => onUnassignTeam(team.id, team.name)}
                  title={`Unassign ${team.name} from project`}
                >
                  <UserMinus className="button-icon" />
                  Unassign
                </button>
              </div>
              
              {team.members && team.members.length > 0 && (
                <div className="team-members">
                  <h5 className="members-title">Members ({team.members.length})</h5>
                  <div className="members-list">
                    {team.members.map((member) => (
                      <div 
                        key={member.id} 
                        className="member-item"
                        onClick={() => {
                          // Use member.name as fallback if sessionName is not available
                          const sessionName = member.sessionName || member.name;
                          console.log('Member clicked:', member.name, 'using session:', sessionName);
                          openTerminalWithSession(sessionName);
                        }}
                        title={member.sessionName ? `Click to open terminal session: ${member.sessionName}` : 'No session available'}
                      >
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-role">{member.role}</span>
                        </div>
                        <div className="member-status">
                          <div className={`status-dot status-dot--${member.status}`} />
                          <span className="status-text">{member.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="team-meta">
                <div className="meta-item">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Last Activity:</span>
                  <span className="meta-value">
                    {new Date(team.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-teams">
          <div className="empty-icon">👥</div>
          <h4 className="empty-title">No teams assigned</h4>
          <p className="empty-description">
            Assign teams to this project to start collaborative development.
          </p>
        </div>
      )}
    </div>
  );
};

// Task Create Modal Component
const TaskCreateModal: React.FC<{
  onClose: () => void;
  onSubmit: (ticketData: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    assignedTo?: string;
  }) => void;
}> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assignedTo: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Task title is required');
      return;
    }
    
    onSubmit({
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      assignedTo: formData.assignedTo.trim() || undefined
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <FormPopup
      isOpen={true}
      onClose={onClose}
      title="Create New Task"
      subtitle="Add a new task to the project backlog"
      onSubmit={handleSubmit}
      submitText="Create Task"
      size="md"
    >
      <FormGroup>
        <FormLabel htmlFor="title" required>
          Task Title
        </FormLabel>
        <FormInput
          id="title"
          value={formData.title}
          onChange={e => handleChange('title', e.target.value)}
          placeholder="Enter task title..."
          required
        />
      </FormGroup>

      <FormGroup>
        <FormLabel htmlFor="description">
          Description
        </FormLabel>
        <FormTextarea
          id="description"
          value={formData.description}
          onChange={e => handleChange('description', e.target.value)}
          placeholder="Enter task description..."
          rows={4}
        />
      </FormGroup>

      <FormRow>
        <FormGroup>
          <FormLabel htmlFor="priority">
            Priority
          </FormLabel>
          <Dropdown
            id="priority"
            value={formData.priority}
            onChange={(value) => handleChange('priority', value)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }
            ]}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="assignedTo">
            Assign To
          </FormLabel>
          <FormInput
            id="assignedTo"
            value={formData.assignedTo}
            onChange={e => handleChange('assignedTo', e.target.value)}
            placeholder="Team member name..."
          />
        </FormGroup>
      </FormRow>
    </FormPopup>
  );
};
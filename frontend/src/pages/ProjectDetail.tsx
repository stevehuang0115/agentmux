import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus, Play, FolderOpen, CheckSquare, FileText, Plus, Trash2, UserMinus, Info, ExternalLink, Square } from 'lucide-react';
import { Project, Team, Ticket } from '../types';
import { apiService } from '../services/api.service';
import { TeamAssignmentModal } from '../components/Modals/TeamAssignmentModal';
import { MarkdownEditor } from '../components/MarkdownEditor/MarkdownEditor';
import { useTerminal } from '../contexts/TerminalContext';
import { Button, useAlert, useConfirm, Dropdown, FormPopup, FormGroup, FormRow, FormLabel, FormInput, FormTextarea, FormHelp } from '../components/UI';
import { DetailView } from '../components/ProjectDetail/DetailView';
import { TasksView } from '../components/ProjectDetail/TasksView';
import { EditorView } from '../components/ProjectDetail/EditorView';
import { TeamsView } from '../components/ProjectDetail/TeamsView';
import { TaskCreateModal } from '../components/ProjectDetail/TaskCreateModal';
import { inProgressTasksService } from '../services/in-progress-tasks.service';

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
  const location = useLocation();
  const navigate = useNavigate();
  const { openTerminalWithSession } = useTerminal();
  const { showAlert, showSuccess, showError, AlertComponent } = useAlert();
  const { showConfirm, showDeleteConfirm, ConfirmComponent } = useConfirm();
  
  // Initialize activeTab from URL hash or default to 'detail'
  const getTabFromHash = () => {
    const hash = location.hash.replace('#', '');
    const validTabs = ['detail', 'editor', 'tasks', 'teams'];
    return validTabs.includes(hash) ? hash as 'detail' | 'editor' | 'tasks' | 'teams' : 'detail';
  };
  
  const [activeTab, setActiveTab] = useState<'detail' | 'editor' | 'tasks' | 'teams'>(getTabFromHash());
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
  const [taskAssignedMemberDetails, setTaskAssignedMemberDetails] = useState<{
    memberName?: string;
    sessionName?: string;
    teamName?: string;
  }>({});
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
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateMilestoneModalOpen, setIsCreateMilestoneModalOpen] = useState(false);
  const [selectedMilestoneFilter, setSelectedMilestoneFilter] = useState<string | null>(null);

  // Update activeTab when hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(getTabFromHash());
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [location.hash]);

  // Update hash when activeTab changes
  const updateActiveTab = (tab: 'detail' | 'editor' | 'tasks' | 'teams') => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`, { replace: true });
  };

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
      const response = await fetch(`/api/projects/${state.project.id}/specs?fileName=alignment_comparison.md`);
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
  const handleTaskClick = async (task: any) => {
    setSelectedTaskForDetail(task);
    setIsTaskDetailModalOpen(true);

    // Load assigned member details if task is in progress
    if (task.status === 'in_progress' || task.path?.includes('/in_progress/')) {
      try {
        const memberDetails = await inProgressTasksService.getTaskAssignedMemberDetails(
          task.path || task.filePath || ''
        );
        setTaskAssignedMemberDetails(memberDetails);
      } catch (error) {
        console.error('Failed to load task assigned member details:', error);
        setTaskAssignedMemberDetails({});
      }
    } else {
      setTaskAssignedMemberDetails({});
    }
  };

  const handleTaskAssign = async (task: any) => {
    if (!state.project) return;
    
    try {
      setTaskAssignmentLoading(task.id);
      
      // Check if orchestrator session exists (using lightweight health check)
      const response = await fetch(`/api/orchestrator/health`);
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
          projectName: state.project.name,
          projectPath: state.project.path,
          configType: 'build_spec_prompt'
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
          projectName: state.project.name,
          projectPath: state.project.path,
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
          projectName: state.project.name,
          projectPath: state.project.path,
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
      const response = await fetch(`/api/projects/${state.project.id}/specs?fileName=initial_goal.md`);
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
      const response = await fetch(`/api/projects/${state.project.id}/specs?fileName=initial_user_journey.md`);
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
        fetch(`/api/projects/${state.project.id}/specs?fileName=initial_goal.md`),
        fetch(`/api/projects/${state.project.id}/specs?fileName=initial_user_journey.md`)
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
        fetch(`/api/projects/${state.project.id}/specs?fileName=initial_goal.md`),
        fetch(`/api/projects/${state.project.id}/specs?fileName=initial_user_journey.md`)
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
          {project.status === 'active' ? (
            <Button
              variant="warning"
              icon={Square}
              onClick={handleStopProject}
              disabled={state.loading}
              title="Stop project and cancel scheduled messages"
            >
              Stop Project
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={Play}
              onClick={handleStartProject}
              disabled={state.loading || assignedTeams.length === 0}
              loading={state.loading}
              title={assignedTeams.length === 0 ? 'Assign a team before starting the project' : 'Start project with assigned teams'}
            >
              {state.loading ? 'Starting...' : 'Start Project'}
            </Button>
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
          onClick={() => updateActiveTab('detail')}
        >
          <Info className="tab-icon" />
          Detail
        </button>
        <button 
          className={`tab ${activeTab === 'editor' ? 'tab--active' : ''}`}
          onClick={() => updateActiveTab('editor')}
        >
          <FolderOpen className="tab-icon" />
          Editor
        </button>
        <button 
          className={`tab ${activeTab === 'tasks' ? 'tab--active' : ''}`}
          onClick={() => updateActiveTab('tasks')}
        >
          <CheckSquare className="tab-icon" />
          Tasks ({tickets.length})
        </button>
        <button 
          className={`tab ${activeTab === 'teams' ? 'tab--active' : ''}`}
          onClick={() => updateActiveTab('teams')}
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
            onCreateSpecsTasks={handleCreateSpecsTasks}
            onCreateDevTasks={handleCreateDevTasks}
            onCreateE2ETasks={handleCreateE2ETasks}
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
          onSubmit={(e) => {
            e.preventDefault();
            handleTaskAssign(selectedTaskForDetail);
            setIsTaskDetailModalOpen(false);
            setSelectedTaskForDetail(null);
          }}
          submitText={taskAssignmentLoading === selectedTaskForDetail.id ? 'Starting...' : 'Start'}
          submitDisabled={taskAssignmentLoading === selectedTaskForDetail.id}
          loading={taskAssignmentLoading === selectedTaskForDetail.id}
          cancelText="Close"
          size="xxl"
        >
          <div className="task-detail-content">
            <FormGroup>
              <FormLabel>Task Title</FormLabel>
              <div className="task-detail-field">{selectedTaskForDetail.title}</div>
            </FormGroup>

            <FormGroup>
              <FormLabel>Description</FormLabel>
              <div className="task-detail-field task-detail-description">
                {selectedTaskForDetail.description ? (
                  <div className="task-content">
                    {selectedTaskForDetail.description.split('\n').map((line: string, index: number) => (
                      <p key={index} className="task-description-line">{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="task-no-description">
                    <span className="no-description-text">No description provided</span>
                    {(selectedTaskForDetail.tasks && selectedTaskForDetail.tasks.length > 0) ||
                     (selectedTaskForDetail.acceptanceCriteria && selectedTaskForDetail.acceptanceCriteria.length > 0) ? (
                      <p className="no-description-help">Task details are available in the sections below.</p>
                    ) : (
                      <p className="no-description-help">This task may need additional details to be added.</p>
                    )}
                  </div>
                )}
              </div>
            </FormGroup>

            {selectedTaskForDetail.acceptanceCriteria && selectedTaskForDetail.acceptanceCriteria.length > 0 && (
              <FormGroup>
                <FormLabel>Acceptance Criteria ({selectedTaskForDetail.acceptanceCriteria.length})</FormLabel>
                <div className="task-detail-acceptance-criteria">
                  {selectedTaskForDetail.acceptanceCriteria.map((criteria: string, index: number) => (
                    <div key={index} className="task-detail-criteria">
                      <span className="criteria-bullet">✓</span>
                      <span className="criteria-text">{criteria}</span>
                    </div>
                  ))}
                </div>
              </FormGroup>
            )}

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

            {/* Show assigned team member for in-progress tasks */}
            {(taskAssignedMemberDetails.memberName || taskAssignedMemberDetails.sessionName) && (
              <FormGroup>
                <FormLabel>Currently Assigned To</FormLabel>
                <div className="task-detail-assigned-member">
                  <div className="assigned-member-info">
                    {taskAssignedMemberDetails.memberName && (
                      <div className="task-detail-badge assignee-badge active-assignee">
                        👤 {taskAssignedMemberDetails.memberName}
                      </div>
                    )}
                    {taskAssignedMemberDetails.sessionName && (
                      <div className="task-detail-badge session-badge">
                        🖥️ {taskAssignedMemberDetails.sessionName}
                      </div>
                    )}
                    {taskAssignedMemberDetails.teamName && (
                      <div className="task-detail-badge team-badge">
                        👥 {taskAssignedMemberDetails.teamName}
                      </div>
                    )}
                  </div>
                  <div className="assigned-member-status">
                    <span className="status-indicator in-progress">● In Progress</span>
                  </div>
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







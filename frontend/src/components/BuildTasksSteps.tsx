import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface BuildTasksStepsProps {
  buildTasksWorkflow?: {
    isActive: boolean;
    steps: Array<{
      id: number;
      name: string;
      delayMinutes: number;
      status: 'pending' | 'scheduled' | 'completed';
      scheduledAt?: Date;
    }>;
  };
  projectId: string;
  projectName?: string;
  onRetryStep?: (stepId: number) => void;
}

interface BuildTaskStep {
  id: number;
  name: string;
  delayMinutes: number;
  status: 'pending' | 'scheduled' | 'completed';
}

interface BuildTaskConfig {
  name: string;
  description: string;
  steps: Array<{
    id: number;
    name: string;
    delayMinutes: number;
    prompts: string[];
    conditional?: string;
  }>;
}

interface TasksStatus {
  hasMilestoneDirectories: boolean;
  hasTaskFiles: boolean;
  milestoneCount: number;
  taskFileCount: number;
}

export const BuildTasksSteps: React.FC<BuildTasksStepsProps> = ({ buildTasksWorkflow, projectId, projectName, onRetryStep }) => {
  const [tasksStatus, setTasksStatus] = useState<TasksStatus>({
    hasMilestoneDirectories: false,
    hasTaskFiles: false,
    milestoneCount: 0,
    taskFileCount: 0,
  });
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [configSteps, setConfigSteps] = useState<BuildTaskStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasksStatus();
    loadBuildTaskConfig();
  }, [projectId]);

  const loadBuildTaskConfig = async () => {
    try {
      const response = await fetch('/api/build-tasks/config');
      if (response.ok) {
        const result = await response.json();
        const config: BuildTaskConfig = result.data;
        // Convert config steps to our format
        const steps: BuildTaskStep[] = config.steps.map(step => ({
          id: step.id,
          name: step.name,
          delayMinutes: step.delayMinutes,
          status: 'pending' as const
        }));
        setConfigSteps(steps);
      }
    } catch (error) {
      console.error('Error loading build task config:', error);
      // Fallback to hardcoded 2-step workflow from build_tasks_prompt.json
      setConfigSteps([
        { id: 1, name: 'Create Project Milestone Phases', delayMinutes: 3, status: 'pending' },
        { id: 2, name: 'Generate Task Files Within Milestones', delayMinutes: 8, status: 'pending' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks-status?_=${Date.now()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTasksStatus(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching tasks status:', error);
    }
  };

  const handleStepRetry = async (step: BuildTaskStep) => {
    if (onRetryStep) {
      // Use parent-provided retry function
      onRetryStep(step.id);
    } else {
      // Fallback to refresh status
      console.log(`Refreshing status for step ${step.id}: ${step.name}`);
      await fetchTasksStatus();
    }
  };

  const getStepIcon = (status: 'pending' | 'scheduled' | 'completed') => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'scheduled':
        return '●';
      case 'pending':
        return '○';
      default:
        return '○';
    }
  };

  // Determine step completion based on the 2-step workflow from build_tasks_prompt.json
  const isStepCompleted = (step: BuildTaskStep): boolean => {
    switch (step.id) {
      case 1: // Create Project Milestone Phases
        return tasksStatus.hasMilestoneDirectories && tasksStatus.milestoneCount >= 3;
      
      case 2: // Generate Task Files Within Milestones
        return tasksStatus.hasTaskFiles && tasksStatus.taskFileCount >= 6; // At least 2 tasks per 3 milestones
      
      default:
        return false;
    }
  };

  // Determine step status based on both workflow status and file existence
  const getActualStepStatus = (step: BuildTaskStep): 'pending' | 'scheduled' | 'completed' => {
    // Check file-based completion first
    if (isStepCompleted(step)) {
      return 'completed';
    }
    
    // Fall back to workflow status if available
    const workflowStep = buildTasksWorkflow?.steps.find(ws => ws.id === step.id);
    return workflowStep?.status || 'pending';
  };

  const getStepStatus = (status: 'pending' | 'scheduled' | 'completed') => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'scheduled':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return 'Pending';
    }
  };

  if (loading) {
    return (
      <div className="build-specs-steps-horizontal">
        <div className="steps-horizontal-container">
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            Loading build tasks steps...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="build-specs-steps-horizontal">
      <div className="steps-horizontal-container">
        {configSteps.map((step, index) => {
          const actualStatus = getActualStepStatus(step);
          const isHovered = hoveredStep === step.id;
          return (
            <div key={step.id} className={`step-horizontal ${actualStatus === 'completed' ? 'completed' : ''}`}>
              <div className="step-horizontal-indicator">
                <div 
                  className={`step-horizontal-circle step-horizontal-circle--${actualStatus} ${isHovered ? 'step-horizontal-circle--hovered' : ''}`}
                  onMouseEnter={() => setHoveredStep(step.id)}
                  onMouseLeave={() => setHoveredStep(null)}
                  onClick={() => handleStepRetry(step)}
                  title={`Retry ${step.name}`}
                  style={{ cursor: 'pointer' }}
                >
                  {isHovered ? (
                    <RotateCcw size={16} />
                  ) : (
                    getStepIcon(actualStatus)
                  )}
                </div>
              </div>
              <div className="step-horizontal-content">
                <div className="step-horizontal-header">
                  <span className="step-horizontal-number">STEP {step.id}</span>
                  <span className={`step-horizontal-status step-horizontal-status--${actualStatus}`}>
                    {getStepStatus(actualStatus)}
                  </span>
                </div>
                <h3 className="step-horizontal-title">{step.name}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
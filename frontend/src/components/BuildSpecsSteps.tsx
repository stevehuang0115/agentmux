import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface BuildSpecsStepsProps {
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
  projectId: string;
  projectName?: string;
}

interface BuildSpecStep {
  id: number;
  name: string;
  delayMinutes: number;
  target: string;
  status: 'pending' | 'scheduled' | 'completed';
}

interface BuildSpecConfig {
  name: string;
  description: string;
  steps: Array<{
    id: number;
    name: string;
    delayMinutes: number;
    target: string;
    prompts: string[];
    conditional?: string;
  }>;
}

interface SpecsStatus {
  hasProjectMd: boolean;
  hasFrontendDesignMd: boolean;
  hasBackendDesignMd: boolean;
  hasMcpDesignMd: boolean;
  hasIntegrationTestsMd: boolean;
  hasUserJourneyMd: boolean;
  hasTasksMd: boolean;
}

interface BuildSpecsStepsExtendedProps extends BuildSpecsStepsProps {
  onRetryStep?: (stepId: number) => void;
}

export const BuildSpecsSteps: React.FC<BuildSpecsStepsExtendedProps> = ({ buildSpecsWorkflow, projectId, projectName, onRetryStep }) => {
  const [specsStatus, setSpecsStatus] = useState<SpecsStatus>({
    hasProjectMd: false,
    hasFrontendDesignMd: false,
    hasBackendDesignMd: false,
    hasMcpDesignMd: false,
    hasIntegrationTestsMd: false,
    hasUserJourneyMd: false,
    hasTasksMd: false,
  });
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [configSteps, setConfigSteps] = useState<BuildSpecStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecsStatus();
    loadBuildSpecConfig();
    
    // Set up polling to check for file changes every 10 seconds
    const interval = setInterval(() => {
      fetchSpecsStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [projectId]);


  const loadBuildSpecConfig = async () => {
    try {
      const response = await fetch('/api/build-specs/config');
      if (response.ok) {
        const config: BuildSpecConfig = await response.json();
        // Convert config steps to our format
        const steps: BuildSpecStep[] = config.steps.map(step => ({
          id: step.id,
          name: step.name,
          delayMinutes: step.delayMinutes,
          target: step.target,
          status: 'pending' as const
        }));
        setConfigSteps(steps);
      }
    } catch (error) {
      console.error('Error loading build spec config:', error);
      // Fallback to actual 3-step workflow from build_spec_prompt.json
      setConfigSteps([
        { id: 1, name: 'Create Project Requirements Document', delayMinutes: 3, status: 'pending', target: 'selected-team-member' },
        { id: 2, name: 'Create Technical Design Documentation', delayMinutes: 6, status: 'pending', target: 'selected-team-member' },
        { id: 3, name: 'Create Integration Testing Plan', delayMinutes: 4, status: 'pending', target: 'selected-team-member' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecsStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/specs-status?_=${Date.now()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Workaround: manually check for integration_tests.md file
          const specsData = result.data;
          
          // Try to verify integration_tests.md exists by attempting to read it
          try {
            const integrationTestResponse = await fetch(`/api/projects/${projectId}/spec-file-content?fileName=integration_tests.md`);
            if (integrationTestResponse.ok) {
              const integrationResult = await integrationTestResponse.json();
              if (integrationResult.success && integrationResult.data && integrationResult.data.content) {
                specsData.hasIntegrationTestsMd = true;
              }
            }
          } catch (error) {
            // Ignore error, keep original status
          }
          
          setSpecsStatus(specsData);
        }
      }
    } catch (error) {
      console.error('Error fetching specs status:', error);
    }
  };

  const handleStepRetry = async (step: any) => {
    if (onRetryStep) {
      // Use parent-provided retry function
      onRetryStep(step.id);
    } else {
      // Fallback to refresh status
      console.log(`Refreshing status for step ${step.id}: ${step.name}`);
      await fetchSpecsStatus();
    }
  };

  // Use configSteps loaded from build_spec_prompt.json

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

  // Determine step completion based on the 3-step workflow from build_spec_prompt.json
  const isStepCompleted = (step: BuildSpecStep): boolean => {
    switch (step.id) {
      case 1: // Create Project Requirements Document
        return specsStatus.hasProjectMd;
      
      case 2: // Create Technical Design Documentation
        return specsStatus.hasFrontendDesignMd || specsStatus.hasBackendDesignMd || specsStatus.hasMcpDesignMd;
      
      case 3: // Create Integration Testing Plan
        return specsStatus.hasIntegrationTestsMd;
      
      default:
        return false;
    }
  };

  // Determine step status based on both workflow status and file existence
  const getActualStepStatus = (step: BuildSpecStep): 'pending' | 'scheduled' | 'completed' => {
    // Check file-based completion first
    if (isStepCompleted(step)) {
      return 'completed';
    }
    
    // Fall back to workflow status if available
    const workflowStep = buildSpecsWorkflow.steps.find(ws => ws.id === step.id);
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

  const getStatusLabel = (step: any) => {
    if (step.status === 'scheduled') {
      return 'In Progress';
    }
    return getStepStatus(step.status);
  };

  if (loading) {
    return (
      <div className="build-specs-steps-horizontal">
        <div className="steps-horizontal-container">
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            Loading build specification steps...
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
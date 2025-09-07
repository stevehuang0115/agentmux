import React, { useState, useEffect } from 'react';
import { FormPopup, Dropdown } from '../UI';

interface Project {
  id: string;
  name: string;
  path: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: 'orchestrator' | 'tpm' | 'pgm' | 'developer' | 'qa' | 'tester' | 'designer';
  systemPrompt: string;
}

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  team?: any;
}

// Default system prompts for each role
const DEFAULT_PROMPTS: Record<string, string> = {
  orchestrator: `You are an AI orchestrator responsible for coordinating and managing team workflows.

Your responsibilities:
- Coordinate tasks between team members
- Monitor project progress and identify blockers
- Facilitate communication between different roles
- Make strategic decisions about task prioritization
- Ensure project milestones are met on time

Communication style:
- Be clear and decisive in your instructions
- Ask clarifying questions when requirements are unclear
- Provide regular status updates to stakeholders
- Focus on maintaining team productivity and morale`,

  tpm: `You are an AI Technical Product Manager (TPM) responsible for scoping projects and translating business logic into technical requirements.

Your responsibilities:
- Analyze business requirements and translate them into technical specifications
- Define technical architecture and design patterns for projects
- Scope project complexity and identify technical dependencies
- Act as a technical leader and provide guidance on implementation approaches
- Create detailed technical design specifications and system architecture documents
- Bridge communication between business stakeholders and engineering teams
- Assess technical feasibility and provide technical risk analysis
- Define technical milestones and deliverables

Technical expertise:
- Strong understanding of software architecture patterns
- Knowledge of system design and scalability considerations
- Experience with technology stack selection and evaluation
- Understanding of performance, security, and reliability requirements

Communication style:
- Explain complex technical concepts in business terms
- Ask probing questions about technical requirements and constraints
- Provide detailed technical specifications and design documents
- Focus on technical feasibility and implementation strategy`,

  pgm: `You are an AI Program Manager (PgM) focused on progress tracking, task creation, and ensuring successful project execution.

Your responsibilities:
- Monitor project progress and track milestone completion
- Create detailed, actionable task tickets from technical specifications
- Break down complex technical designs into executable development tasks
- Define clear acceptance criteria and success metrics for each task
- Ensure requirements are clearly articulated for 100% developer success rate
- Coordinate between different team roles and manage dependencies
- Track blockers and facilitate resolution
- Maintain project timeline and manage scope changes

Task management expertise:
- Expert at writing clear, unambiguous task descriptions
- Deep experience in requirement gathering and clarification
- Strong understanding of development workflows and dependencies
- Knowledge of testing and quality assurance processes

Communication style:
- Write extremely detailed and clear task specifications
- Ask clarifying questions to eliminate ambiguity
- Provide step-by-step implementation guidance
- Focus on actionable deliverables and measurable outcomes`,

  'frontend-developer': `You are an AI Frontend Developer specializing in user interface development and user experience.

Your responsibilities:
- Create responsive and accessible user interfaces
- Build reusable and maintainable React/Vue/Angular components
- Implement CSS, SCSS, Tailwind, or styled-components
- Handle client-side state with Redux, Context API, or similar
- Write unit and integration tests for frontend components
- Optimize bundle size, rendering, and user experience

Communication style:
- Focus on user experience and interface design
- Collaborate effectively with backend developers and designers
- Write clean, maintainable, and well-documented code
- Follow modern frontend development practices
- Ensure accessibility and responsive design principles`,

  'backend-developer': `You are an AI Backend Developer specializing in server-side development and system architecture.

Your responsibilities:
- Design and implement RESTful APIs and GraphQL endpoints
- Create efficient database schemas and optimize queries
- Implement secure authentication and authorization systems
- Optimize server performance, caching, and scalability
- Ensure secure coding practices and data protection
- Work with cloud services, containers, and deployment pipelines

Communication style:
- Focus on system architecture and scalable solutions
- Collaborate effectively with frontend developers and DevOps engineers
- Write efficient, secure, and maintainable server-side code
- Follow best practices for API design and database optimization
- Consider performance, security, and maintainability in all decisions`,

  developer: `You are an AI Software Developer responsible for writing, testing, and maintaining code.

Your responsibilities:
- Implement features according to specifications
- Write clean, maintainable, and well-documented code
- Conduct code reviews and provide constructive feedback
- Debug issues and optimize performance
- Collaborate with other developers on technical decisions

Communication style:
- Ask technical clarifying questions when needed
- Explain complex technical concepts clearly
- Suggest alternative approaches when appropriate
- Focus on code quality and best practices`,

  qa: `You are an AI Quality Assurance Engineer focused on ensuring product quality and reliability.

Your responsibilities:
- Design and execute comprehensive test plans
- Identify and document bugs and issues
- Verify bug fixes and feature implementations
- Ensure compliance with quality standards
- Collaborate with developers on testing strategies

Communication style:
- Be thorough and detail-oriented in bug reports
- Ask specific questions about expected behavior
- Provide clear steps to reproduce issues
- Focus on user experience and edge cases`,

  tester: `You are an AI Test Engineer responsible for automated and manual testing of software systems.

Your responsibilities:
- Create and maintain automated test suites
- Execute manual testing for new features
- Perform regression testing on releases
- Set up and maintain testing environments
- Report and track defects through resolution

Communication style:
- Provide clear, actionable test results
- Ask specific questions about test scenarios
- Document testing procedures and findings
- Focus on system reliability and performance`,

  designer: `You are an AI UX/UI Designer responsible for creating user-centered design solutions.

Your responsibilities:
- Design intuitive and accessible user interfaces
- Create wireframes, mockups, and prototypes
- Conduct user research and usability testing
- Collaborate with developers on implementation feasibility
- Ensure consistent design system usage

Communication style:
- Ask about user needs and business goals
- Explain design decisions and rationale
- Provide detailed design specifications
- Focus on user experience and accessibility`
};

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, onSubmit, team }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectPath: '',
  });
  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'Technical Product Manager',
      role: 'tpm' as const,
      systemPrompt: DEFAULT_PROMPTS.tpm
    },
    {
      id: '2',
      name: 'Program Manager',
      role: 'pgm' as const,
      systemPrompt: DEFAULT_PROMPTS.pgm
    }
  ]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    if (team) {
      setFormData({
        name: team.name || '',
        description: team.description || '',
        projectPath: team.projectPath || '',
      });
      if (team.members && Array.isArray(team.members)) {
        setMembers(team.members);
      }
    }
  }, [team]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const result = await response.json();
        const projectsData = result.success ? (result.data || []) : (result || []);
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMemberChange = (memberId: string, field: keyof TeamMember, value: string) => {
    setMembers(prev => prev.map(member => 
      member.id === memberId 
        ? { 
            ...member, 
            [field]: value,
            // Auto-update system prompt when role changes, but only if it hasn't been customized
            ...(field === 'role' && member.systemPrompt === DEFAULT_PROMPTS[member.role] 
              ? { systemPrompt: DEFAULT_PROMPTS[value] }
              : {}
            )
          }
        : member
    ));
  };

  const addMember = () => {
    const newId = (Math.max(...members.map(m => parseInt(m.id))) + 1).toString();
    const newMember: TeamMember = {
      id: newId,
      name: 'Developer',
      role: 'developer',
      systemPrompt: DEFAULT_PROMPTS.developer
    };
    setMembers(prev => [...prev, newMember]);
  };

  const removeMember = (memberId: string) => {
    if (members.length > 1) {
      setMembers(prev => prev.filter(member => member.id !== memberId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || members.length === 0) return;

    // Validate all members have required fields
    for (const member of members) {
      if (!member.name.trim()) {
        alert('All team members must have a name');
        return;
      }
    }

    setLoading(true);
    try {
      // Convert selected project ID to proper format
      const selectedProject = projects.find(p => p.id === formData.projectPath);
      const submitData = {
        ...formData,
        members: members.map(member => ({
          name: member.name,
          role: member.role,
          systemPrompt: member.systemPrompt
        })),
        currentProject: formData.projectPath || undefined, // Send project ID, not path
        projectPath: selectedProject ? selectedProject.path : undefined, // Keep path for backend processing
      };
      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting team:', error);
    } finally {
      setLoading(false);
    }
  };


  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      orchestrator: 'Orchestrator',
      tpm: 'Technical Product Manager',
      pgm: 'Program Manager',
      'frontend-developer': 'Frontend Developer',
      'backend-developer': 'Backend Developer',
      developer: 'Developer',
      qa: 'QA Engineer',
      tester: 'Test Engineer',
      designer: 'Designer'
    };
    return roleNames[role] || role;
  };

  return (
    <FormPopup
      isOpen={isOpen}
      onClose={onClose}
      title={team ? 'Edit Team' : 'Create New Team'}
      subtitle={team ? 'Modify team configuration and members' : 'Set up a new collaborative team'}
      size="xl"
      onSubmit={handleSubmit}
      submitText={team ? 'Update Team' : 'Create Team'}
      submitDisabled={!formData.name.trim() || members.length === 0}
      loading={loading}
    >
          <div className="form-group">
            <label htmlFor="name">Team Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter team name (e.g., Frontend Team)"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the team's purpose"
            />
          </div>

          <div className="form-group">
            <label htmlFor="projectPath">Project (Optional)</label>
            <Dropdown
              id="projectPath"
              name="projectPath"
              value={formData.projectPath}
              onChange={(value) => setFormData(prev => ({ ...prev, projectPath: value }))}
              placeholder="No project assigned"
              options={projects.map(project => ({
                value: project.id,
                label: `${project.name} (${project.path})`
              }))}
            />
          </div>

          <div className="team-members-section">
            <div className="section-header">
              <h3>Team Members ({members.length})</h3>
              <button type="button" className="add-member-button" onClick={addMember}>
                + Add Member
              </button>
            </div>

            <div className="team-members-list">
              {members.map((member, index) => (
                <div key={member.id} className="team-member-card">
                  <div className="member-header">
                    <h4>Member {index + 1}</h4>
                    {members.length > 1 && (
                      <button
                        type="button"
                        className="remove-member-button"
                        onClick={() => removeMember(member.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="member-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)}
                          placeholder="Member name"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Role *</label>
                        <Dropdown
                          value={member.role}
                          onChange={(value) => handleMemberChange(member.id, 'role', value)}
                          required
                          options={[
                            { value: 'orchestrator', label: 'Orchestrator' },
                            { value: 'tpm', label: 'Technical Product Manager' },
                            { value: 'pgm', label: 'Program Manager' },
                            { value: 'frontend-developer', label: 'Frontend Developer' },
                            { value: 'backend-developer', label: 'Backend Developer' },
                            { value: 'developer', label: 'Developer' },
                            { value: 'qa', label: 'QA Engineer' },
                            { value: 'tester', label: 'Test Engineer' },
                            { value: 'designer', label: 'Designer' }
                          ]}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
    </FormPopup>
  );
};
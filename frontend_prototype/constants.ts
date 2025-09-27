import { Project, Team, TeamMember, ProjectStatus, TeamMemberStatus, ScheduledMessage, MessageLog, MessageStatus, Task } from './types';

// Team Members
export const teamMembers: TeamMember[] = [
  { id: 'tm1', name: 'Alex "React" Rivera', role: 'Frontend Developer', avatarUrl: 'https://picsum.photos/seed/alex/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-alex/100/100', session: 'Alpha-Build-42', status: TeamMemberStatus.Started },
  { id: 'tm2', name: 'Jordan "Vue" Vance', role: 'Frontend Developer', avatarUrl: 'https://picsum.photos/seed/jordan/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-jordan/100/100', session: 'Beta-UI-Refresh', status: TeamMemberStatus.Started },
  { id: 'tm3', name: 'Casey "CSS" Cobb', role: 'UI/UX Designer', avatarUrl: 'https://picsum.photos/seed/casey/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-casey/100/100', session: 'Inactive', status: TeamMemberStatus.Stopped },
  { id: 'tm4', name: 'Sam "Node" Nazari', role: 'Backend Developer', avatarUrl: 'https://picsum.photos/seed/sam/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-sam/100/100', session: 'API-Gateway-v2', status: TeamMemberStatus.Started },
  { id: 'tm5', name: 'Morgan "Mongo" Maxwell', role: 'Database Admin', avatarUrl: 'https://picsum.photos/seed/morgan/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-morgan/100/100', session: 'DB-Migration-Task', status: TeamMemberStatus.Started },
  { id: 'tm6', name: 'Drew "Docker" Daniels', role: 'DevOps Engineer', avatarUrl: 'https://picsum.photos/seed/drew/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-drew/100/100', session: 'CI-CD-Pipeline-4', status: TeamMemberStatus.Started },
  { id: 'tm7', name: 'Pat "Python" Patel', role: 'Data Scientist', avatarUrl: 'https://picsum.photos/seed/pat/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-pat/100/100', session: 'Model-Training-Run-7', status: TeamMemberStatus.Stopped },
  { id: 'tm8', name: 'Quinn "QA" Quest', role: 'QA Engineer', avatarUrl: 'https://picsum.photos/seed/quinn/100/100', assistantAvatarUrl: 'https://picsum.photos/seed/a-quinn/100/100', session: 'E2E-Test-Suite', status: TeamMemberStatus.Started },
];

// Teams
export const teams: Team[] = [
  { id: 'team1', name: 'Frontend Wizards', description: 'Responsible for UI/UX development.', status: 'Active', members: [teamMembers[0], teamMembers[1], teamMembers[2]], assignedProject: 'Project Phoenix' },
  { id: 'team2', name: 'Backend Ninjas', description: 'Manages server-side logic and database.', status: 'Active', members: [teamMembers[3], teamMembers[4]], assignedProject: 'Project Phoenix' },
  { id: 'team3', name: 'DevOps Dynamos', description: 'Handles infrastructure and deployment.', status: 'Active', members: [teamMembers[5]], assignedProject: 'Project Nova' },
  { id: 'team4', name: 'QA Sentinels', description: 'Ensures application quality and stability.', status: 'Active', members: [teamMembers[7]], assignedProject: 'Project Nova' },
  { id: 'team5', name: 'Data Science League', description: 'Develops machine learning models.', status: 'Paused', members: [teamMembers[6]], assignedProject: 'Project Atlas' },
];

// Projects
export const projects: Project[] = [
  { id: 'proj1', name: 'Project Phoenix', description: 'Scalable e-commerce platform.', progress: 75, status: ProjectStatus.Running, teams: [teams[0], teams[1]], dueDate: '24 Dec 2024', path: '/projects/phoenix' },
  { id: 'proj2', name: 'Project Nova', description: 'AI-powered data analytics tool.', progress: 30, status: ProjectStatus.Paused, teams: [teams[2], teams[3]], dueDate: '15 Jan 2025', path: '/projects/nova' },
  { id: 'proj3', name: 'Project Orion', description: 'Mobile application for remote team collaboration.', progress: 100, status: ProjectStatus.Completed, teams: [], completedDate: '1 Dec 2023', path: '/projects/orion' },
  { id: 'proj4', name: 'Project Nebula', description: 'Internal knowledge base system using machine learning.', progress: 50, status: ProjectStatus.Running, teams: [], dueDate: '28 Feb 2025', path: '/projects/nebula' },
  { id: 'proj5', name: 'Project Galileo', description: 'Data visualization dashboard for space exploration data.', progress: 15, status: ProjectStatus.Blocked, teams: [], dueDate: 'TBD', path: '/projects/galileo' },
  { id: 'proj6', name: 'Project Echo', description: 'Real-time voice translation service.', progress: 90, status: ProjectStatus.Running, teams: [], dueDate: '31 Mar 2025', path: '/projects/echo' },
  { id: 'proj7', name: 'Project Atlas', description: 'A new data mapping initiative.', progress: 5, status: ProjectStatus.Running, teams: [teams[4]], dueDate: '1 Jun 2025', path: '/projects/atlas' },
];

// Scheduled Messages
export const scheduledMessages: ScheduledMessage[] = [
    { id: 'sm1', name: 'Daily Standup Reminder', targetType: 'Team', targetName: 'Frontend Wizards', schedule: 'Every weekday at 9 AM', status: 'Active', message: 'Friendly reminder: Daily standup in 15 minutes! Please prepare your updates.' },
    { id: 'sm2', name: 'Weekly Progress Report', targetType: 'Project', targetName: 'Project Phoenix', schedule: 'Every Friday at 5 PM', status: 'Active', message: 'Weekly progress report for Project Phoenix is due today. Please submit your updates by EOD.' },
    { id: 'sm3', name: 'Server Status Check', targetType: 'Project', targetName: 'Project Nova', schedule: 'Every 30 minutes', status: 'Active', message: 'Pinging server status for Project Nova. All systems nominal.' },
    { id: 'sm4', name: 'Deployment Notification', targetType: 'Team', targetName: 'DevOps Dynamos', schedule: 'Once on 2023-10-25', status: 'Completed', message: 'Deployment for version 2.1.0 to production has been successfully completed.' },
];

// Message Logs
export const messageLogs: MessageLog[] = [
    { id: 'ml1', timestamp: '2023-10-27 09:30:15', message: 'Server Status Check', target: 'Project: Project Nova', status: MessageStatus.Delivered },
    { id: 'ml2', timestamp: '2023-10-27 09:00:05', message: 'Daily Standup Reminder', target: 'Team: Frontend Wizards', status: MessageStatus.Delivered },
    { id: 'ml3', timestamp: '2023-10-27 09:00:00', message: 'Server Status Check', target: 'Project: Project Nova', status: MessageStatus.Delivered },
    { id: 'ml4', timestamp: '2023-10-26 17:00:00', message: 'Weekly Progress Report', target: 'Project: Project Phoenix', status: MessageStatus.Failed },
    { id: 'ml5', timestamp: '2023-10-26 09:30:00', message: 'Server Status Check', target: 'Project: Project Nova', status: MessageStatus.Delivered },
];

export const availableAvatars: string[] = [
  'https://picsum.photos/seed/avatar1/100/100',
  'https://picsum.photos/seed/avatar2/100/100',
  'https://picsum.photos/seed/avatar3/100/100',
  'https://picsum.photos/seed/avatar4/100/100',
  'https://picsum.photos/seed/avatar5/100/100',
  'https://picsum.photos/seed/avatar6/100/100',
  'https://picsum.photos/seed/avatar7/100/100',
  'https://picsum.photos/seed/avatar8/100/100',
];

export const taskData: Task[] = [
    { 
        id: 'task-1', 
        title: 'Setup database schema and migrations', 
        priority: 'High', 
        assignee: 'https://picsum.photos/seed/morgan/100/100', 
        status: 'Open',
        milestone: 'M1: Foundation',
        description: 'Establish the foundational database structure, including all necessary tables, relationships, and constraints. Implement a migration system to handle schema changes over time.',
        dependencies: []
    },
    { 
        id: 'task-2', 
        title: 'Implement user authentication endpoints', 
        priority: 'Medium', 
        assignee: 'https://picsum.photos/seed/sam/100/100', 
        status: 'Open',
        milestone: 'M1: Foundation',
        description: 'Create secure API endpoints for user registration, login, logout, and password recovery. Ensure proper password hashing and session management.',
        dependencies: [{ id: 'task-1', title: 'Setup database schema and migrations', status: 'Open' }]
    },
    { 
        id: 'task-3', 
        title: 'Design initial UI mockups for dashboard', 
        priority: 'Low', 
        assignee: 'https://picsum.photos/seed/casey/100/100', 
        status: 'Open',
        milestone: 'M3: UI/UX Polish',
        description: 'Develop high-fidelity mockups and a design system for the main dashboard, project overview, and task management pages.',
        dependencies: []
    },
    { 
        id: 'task-4', 
        title: 'Develop API for project management', 
        priority: 'High', 
        assignee: 'https://picsum.photos/seed/sam/100/100', 
        status: 'In Progress',
        milestone: 'M2: Core Features',
        description: 'The core of Project Phoenix revolves around robust project management capabilities. This task involves creating a comprehensive API that will handle all aspects of project creation, task management, team collaboration, and progress tracking. The API should be designed to be scalable, secure, and well-documented to facilitate future development and integration with frontend components.',
        dependencies: [{ id: 'task-1', title: 'Setup database schema and migrations', status: 'Done' }]
    },
    { 
        id: 'task-5', 
        title: 'Create frontend components for task display', 
        priority: 'Medium', 
        assignee: 'https://picsum.photos/seed/alex/100/100', 
        status: 'In Progress',
        milestone: 'M2: Core Features',
        description: 'Build reusable React components for displaying tasks in various formats, including cards for the Kanban board and list items. Components should be dynamic and reflect task status and details.',
        dependencies: []
    },
    { 
        id: 'task-6', 
        title: 'Setup project repository on GitHub', 
        priority: 'Low', 
        assignee: 'https://picsum.photos/seed/drew/100/100', 
        status: 'Done',
        milestone: 'M1: Foundation',
        description: 'Initialize the Git repository on GitHub, establish branching strategies (e.g., GitFlow), and configure CI/CD pipelines for automated testing and deployment.',
        dependencies: []
    },
    { 
        id: 'task-7', 
        title: 'Define project milestones and roadmap', 
        priority: 'Medium', 
        assignee: 'https://picsum.photos/seed/olivia/100/100', 
        status: 'Done',
        milestone: 'M1: Foundation',
        description: 'Outline the key milestones for the project, define the features for each, and create a high-level roadmap with estimated timelines.',
        dependencies: []
    },
    { 
        id: 'task-8', 
        title: 'Integrate third-party payment gateway', 
        priority: 'High', 
        assignee: 'https://picsum.photos/seed/jordan/100/100', 
        status: 'Blocked',
        milestone: 'M4: Launch',
        description: 'Integrate Stripe API for handling payments. This is currently blocked pending API key approval from the finance department.',
        dependencies: [{ id: 'task-4', title: 'Develop API for project management', status: 'In Progress' }]
    },
];
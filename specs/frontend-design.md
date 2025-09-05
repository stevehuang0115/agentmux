# AgentMux UI/UX Specification - Revised

Based on your requirements, here's the complete UI specification with page layouts and component hierarchy.

## Site Navigation Structure

```
AgentMux
├── Dashboard (/)
├── Projects (/projects)
│   └── Project Detail (/projects/:id)
│       ├── Editor Tab
│       └── Tasks Tab
├── Teams (/teams)
│   └── Team Detail (/teams/:id)
│       └── Member Detail (/teams/:id/member/:memberId)
└── Assignments (/assignments)
```

## Page Specifications

### 1. Dashboard Page

```typescript
// pages/Dashboard.tsx
interface DashboardProps {
	topProjects: Project[];
	topTeams: Team[];
}

const Dashboard = () => {
	return (
		<div className="dashboard">
			{/* Projects Section */}
			<section className="dashboard-section">
				<div className="section-header">
					<h2>Projects</h2>
					<Button onClick={navigateToProjects}>View All</Button>
				</div>
				<div className="cards-grid">
					{topProjects.map((project) => (
						<ProjectCard key={project.id} project={project} />
					))}
					<CreateCard
						title="New Project"
						onClick={openProjectCreator}
						icon={<PlusIcon />}
					/>
				</div>
			</section>

			{/* Teams Section */}
			<section className="dashboard-section">
				<div className="section-header">
					<h2>Teams</h2>
					<Button onClick={navigateToTeams}>View All</Button>
				</div>
				<div className="cards-grid">
					{topTeams.map((team) => (
						<TeamCard key={team.id} team={team} />
					))}
					<CreateCard title="New Team" onClick={openTeamCreator} icon={<PlusIcon />} />
				</div>
			</section>
		</div>
	);
};
```

### 2. Projects Page

```typescript
// pages/Projects.tsx
const Projects = () => {
	return (
		<div className="projects-page">
			<header className="page-header">
				<h1>Projects</h1>
				<Button variant="primary" onClick={createProject}>
					<PlusIcon /> New Project
				</Button>
			</header>

			<div className="projects-grid">
				{projects.map((project) => (
					<ProjectCard
						key={project.id}
						project={project}
						showStatus
						showTeams
						onClick={() => navigateToProject(project.id)}
					/>
				))}
			</div>
		</div>
	);
};
```

### 3. Project Detail Page

```typescript
// pages/ProjectDetail.tsx
const ProjectDetail = () => {
	const [activeTab, setActiveTab] = useState<'editor' | 'tasks'>('editor');
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [assignedTeams, setAssignedTeams] = useState<Team[]>([]);

	return (
		<div className="project-detail">
			{/* Project Header */}
			<header className="project-header">
				<div className="project-info">
					<h1>{project.name}</h1>
					<span className="project-path">{project.path}</span>
				</div>
				<div className="project-actions">
					<Button variant="secondary" onClick={openTeamAssigner}>
						Assign Team
					</Button>
					{assignedTeams.length > 0 && (
						<Button variant="primary" onClick={startProject}>
							Start Project
						</Button>
					)}
				</div>
			</header>

			{/* Tabs */}
			<div className="tabs">
				<Tab active={activeTab === 'editor'} onClick={() => setActiveTab('editor')}>
					Editor
				</Tab>
				<Tab active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')}>
					Tasks
				</Tab>
			</div>

			{/* Tab Content */}
			{activeTab === 'editor' ? <EditorView /> : <TasksView />}
		</div>
	);
};

// Editor Tab Component
const EditorView = () => {
	return (
		<div className="editor-view">
			{/* Left Panel - File Tree */}
			<div className="file-tree-panel">
				<FileTree rootPath={`${project.path}/.agentmux`} onFileSelect={setSelectedFile} />
			</div>

			{/* Right Panel - Editor/Info */}
			<div className="editor-panel">
				{selectedFile ? (
					selectedFile.endsWith('.md') ? (
						<MarkdownEditor file={selectedFile} onChange={saveFile} />
					) : (
						<FileViewer file={selectedFile} />
					)
				) : (
					<ProjectInfo
						name={project.name}
						description={project.description}
						onUpdate={updateProject}
					/>
				)}
			</div>
		</div>
	);
};

// Tasks Tab Component
const TasksView = () => {
	return (
		<div className="kanban-board">
			<KanbanColumn
				title="Not Started"
				tickets={tickets.filter((t) => t.status === 'todo')}
			/>
			<KanbanColumn
				title="In Progress"
				tickets={tickets.filter((t) => t.status === 'in_progress')}
			/>
			<KanbanColumn
				title="In Testing"
				tickets={tickets.filter((t) => t.status === 'testing')}
			/>
			<KanbanColumn title="Done" tickets={tickets.filter((t) => t.status === 'done')} />
		</div>
	);
};
```

### 4. Teams Page

```typescript
// pages/Teams.tsx
const Teams = () => {
	return (
		<div className="teams-page">
			<header className="page-header">
				<h1>Teams</h1>
				<Button variant="primary" onClick={createTeam}>
					<PlusIcon /> New Team
				</Button>
			</header>

			<div className="teams-grid">
				{teams.map((team) => (
					<TeamCard
						key={team.id}
						team={team}
						showMembers
						showProject
						onClick={() => navigateToTeam(team.id)}
					/>
				))}
			</div>
		</div>
	);
};
```

### 5. Team Detail Page

```typescript
// pages/TeamDetail.tsx
const TeamDetail = () => {
	const [selectedMember, setSelectedMember] = useState<string | null>(null);

	return (
		<div className="team-detail">
			<header className="team-header">
				<h1>{team.name}</h1>
				{team.currentProject && (
					<div className="project-badge">Working on: {team.currentProject.name}</div>
				)}
			</header>

			<div className="team-content">
				{/* Members List */}
				<div className="members-section">
					<h2>Team Members</h2>
					<div className="members-list">
						{team.members.map((member) => (
							<MemberCard
								key={member.id}
								member={member}
								isSelected={selectedMember === member.id}
								onClick={() => setSelectedMember(member.id)}
							/>
						))}
					</div>
				</div>

				{/* Member Detail View */}
				{selectedMember && <MemberDetailView memberId={selectedMember} />}
			</div>
		</div>
	);
};

// Member Detail Component
const MemberDetailView = ({ memberId }) => {
	return (
		<div className="member-detail">
			{/* Left Panel - System Instructions */}
			<div className="instructions-panel">
				<h3>System Instructions</h3>
				<CodeEditor
					value={member.systemPrompt}
					language="markdown"
					onChange={updateSystemPrompt}
				/>
				<Button onClick={saveInstructions}>Save Instructions</Button>
			</div>

			{/* Right Panel - Terminal Viewer */}
			<div className="terminal-panel">
				<h3>Terminal Output</h3>
				<TerminalViewer sessionName={member.sessionName} height="600px" autoScroll />
			</div>
		</div>
	);
};
```

### 6. Assignments Page

```typescript
// pages/Assignments.tsx
const Assignments = () => {
	const [view, setView] = useState<'projects' | 'teams'>('projects');
	const [showTerminal, setShowTerminal] = useState(true);

	return (
		<div className="assignments-page">
			{/* Main Content */}
			<div className="assignments-content">
				{/* Left Panel - Assignments List */}
				<div className="assignments-panel">
					<header className="panel-header">
						<h2>Active Assignments</h2>
						<ToggleGroup
							value={view}
							onChange={setView}
							options={[
								{ value: 'projects', label: 'Projects View' },
								{ value: 'teams', label: 'Teams View' },
							]}
						/>
					</header>

					{view === 'projects' ? (
						<ProjectAssignments projects={activeProjects} />
					) : (
						<TeamAssignments teams={activeTeams} />
					)}
				</div>

				{/* Right Panel - Orchestrator Terminal */}
				{showTerminal && (
					<div className="orchestrator-panel">
						<header className="panel-header">
							<h3>Orchestrator</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowTerminal(false)}
							>
								<CloseIcon />
							</Button>
						</header>

						<OrchestratorTerminal />
					</div>
				)}
			</div>

			{/* Terminal Toggle Button (when hidden) */}
			{!showTerminal && (
				<Button className="terminal-toggle" onClick={() => setShowTerminal(true)}>
					Show Orchestrator
				</Button>
			)}
		</div>
	);
};

// Orchestrator Terminal Component
const OrchestratorTerminal = () => {
	return (
		<div className="orchestrator-terminal">
			<TerminalViewer sessionName="orchestrator" height="calc(100vh - 200px)" autoScroll />
			<div className="terminal-input">
				<Input
					placeholder="Send message to orchestrator..."
					onSubmit={sendToOrchestrator}
				/>
			</div>
		</div>
	);
};
```

## Component Specifications

### 1. Card Components

```typescript
// components/Cards/ProjectCard.tsx
interface ProjectCardProps {
	project: Project;
	showStatus?: boolean;
	showTeams?: boolean;
	onClick?: () => void;
}

// components/Cards/TeamCard.tsx
interface TeamCardProps {
	team: Team;
	showMembers?: boolean;
	showProject?: boolean;
	onClick?: () => void;
}

// components/Cards/CreateCard.tsx
interface CreateCardProps {
	title: string;
	icon: React.ReactNode;
	onClick: () => void;
}
```

### 2. Modal Components

```typescript
// components/Modals/TeamAssigner.tsx
interface TeamAssignerProps {
	projectId: string;
	availableTeams: Team[];
	onAssign: (teamIds: string[]) => void;
	onClose: () => void;
}

const TeamAssigner = ({ availableTeams, onAssign, onClose }) => {
	return (
		<Modal title="Assign Teams" onClose={onClose}>
			{availableTeams.length > 0 ? (
				<div className="teams-list">
					{availableTeams.map((team) => (
						<TeamSelectItem key={team.id} team={team} />
					))}
				</div>
			) : (
				<EmptyState>
					<p>No available teams</p>
					<Button onClick={navigateToTeams}>Create Team</Button>
				</EmptyState>
			)}

			<div className="modal-footer">
				<Button variant="secondary" onClick={onClose}>
					Cancel
				</Button>
				<Button variant="primary" onClick={handleAssign}>
					Assign
				</Button>
			</div>
		</Modal>
	);
};
```

### 3. Editor Components

```typescript
// components/Editor/FileTree.tsx
interface FileTreeProps {
	rootPath: string;
	onFileSelect: (path: string) => void;
}

// components/Editor/MarkdownEditor.tsx
interface MarkdownEditorProps {
	file: string;
	onChange: (content: string) => void;
}

// components/Editor/CodeEditor.tsx
interface CodeEditorProps {
	value: string;
	language: string;
	onChange: (value: string) => void;
	readOnly?: boolean;
}
```

### 4. Kanban Components

```typescript
// components/Kanban/KanbanColumn.tsx
interface KanbanColumnProps {
	title: string;
	tickets: Ticket[];
	onTicketClick: (ticket: Ticket) => void;
	onTicketDrop: (ticket: Ticket) => void;
}

// components/Kanban/TicketCard.tsx
interface TicketCardProps {
	ticket: Ticket;
	onClick: () => void;
	isDragging?: boolean;
}
```

## Layout Styles

```css
/* Layout Grid System */
.dashboard-section {
	margin-bottom: 48px;
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 24px;
}

.cards-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: 24px;
}

/* Split Panel Layouts */
.editor-view,
.member-detail,
.assignments-content {
	display: grid;
	grid-template-columns: 1fr 2fr;
	height: calc(100vh - 200px);
	gap: 24px;
}

.file-tree-panel,
.instructions-panel,
.assignments-panel {
	border-right: 1px solid #e5e5e5;
	padding-right: 24px;
	overflow-y: auto;
}

.editor-panel,
.terminal-panel,
.orchestrator-panel {
	overflow-y: auto;
}

/* Kanban Board */
.kanban-board {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 24px;
	padding: 24px;
	overflow-x: auto;
}

.kanban-column {
	background: #f5f5f5;
	border-radius: 12px;
	padding: 16px;
	min-height: 600px;
}
```

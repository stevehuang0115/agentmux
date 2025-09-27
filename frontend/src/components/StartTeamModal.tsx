import React, { useState, useEffect } from 'react';
import { useAlert } from './UI/Dialog';
import { FormPopup, FormSection, FormGroup, FormLabel, Dropdown, Toggle } from './UI';

interface Project {
	id: string;
	name: string;
	path: string;
	description?: string;
}

interface StartTeamModalProps {
	isOpen: boolean;
	onClose: () => void;
	onStartTeam: (projectId: string, enableGitReminder: boolean) => void;
	team: any;
	loading: boolean;
}

export const StartTeamModal: React.FC<StartTeamModalProps> = ({
	isOpen,
	onClose,
	onStartTeam,
	team,
	loading,
} ) => {
	const { showWarning, AlertComponent } = useAlert();
	const [selectedProject, setSelectedProject] = useState<string>('');
	const [enableGitReminder, setEnableGitReminder] = useState<boolean>(true);
	const [projects, setProjects] = useState<Project[]>([]);
	const [fetchingProjects, setFetchingProjects] = useState(false);

	// Check if team is already assigned to a project
	const isAlreadyAssigned = team?.currentProject;

	useEffect(() => {
		if (isOpen) {
			fetchProjects();
			if (isAlreadyAssigned) {
				setSelectedProject(team.currentProject);
			}
		}
	}, [isOpen, isAlreadyAssigned, team?.currentProject]);

	const fetchProjects = async () => {
		setFetchingProjects(true);
		try {
			const response = await fetch('/api/projects');
			if (response.ok) {
				const result = await response.json();
				const projectsData = result.success ? result.data || [] : result || [];
				setProjects(Array.isArray(projectsData) ? projectsData : []);
			}
		} catch (error) {
			console.error('Error fetching projects:', error);
			setProjects([]);
		} finally {
			setFetchingProjects(false);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!isAlreadyAssigned && !selectedProject) {
			showWarning('Please select a project');
			return;
		}

		const projectId = isAlreadyAssigned ? team.currentProject : selectedProject;
		onStartTeam(projectId, enableGitReminder);
		onClose(); // Close popup after starting team
	};

	const getAssignedProjectName = () => {
		if (!isAlreadyAssigned) return '';
		const project = projects.find((p) => p.id === team.currentProject);
		return project ? project.name : 'Unknown Project';
	};

	return (
		<>
		<FormPopup
			isOpen={isOpen}
			onClose={onClose}
			title="Start Team"
			subtitle={`Configure settings for ${team?.name || 'team'}`}
			size="xl"
			onSubmit={handleSubmit}
			submitText={loading ? 'Starting...' : 'Proceed'}
			submitDisabled={loading || (!isAlreadyAssigned && !selectedProject)}
			loading={loading}
		>
			<FormSection
				title="Project Assignment"
				description={
					isAlreadyAssigned ? undefined : 'Select which project this team will work on'
				}
			>
				{isAlreadyAssigned ? (
					<div className="form-info-box form-info-box--success">
						<div className="form-info-content">
							<strong>Already assigned to:</strong> {getAssignedProjectName()}
						</div>
					</div>
				) : (
					<FormGroup>
						<FormLabel htmlFor="project-select" required>
							Select Project
						</FormLabel>
						<Dropdown
							id="project-select"
							value={selectedProject}
							onChange={setSelectedProject}
							placeholder="Choose a project..."
							loading={fetchingProjects}
							required
							options={projects.map((project) => ({
								value: project.id,
								label: `${project.name} (${project.path})`,
							}))}
						/>
					</FormGroup>
				)}
			</FormSection>

			<FormSection title="Team Settings">
				<FormGroup>
					<Toggle
						checked={enableGitReminder}
						onChange={(e) => setEnableGitReminder(e.target.checked)}
						label="Enable git reminder every 30 minutes"
						description="Team members will receive automated reminders to commit their changes every 30 minutes"
					/>
				</FormGroup>
			</FormSection>

			<div className="form-info-box form-info-box--info">
				<div className="form-info-header">
					<h4>Team: {team?.name}</h4>
				</div>
				<div className="form-info-content">
					<div>Members: {team?.members?.length || 0}</div>
					<div>Status: {team?.status || 'idle'}</div>
				</div>
			</div>
		</FormPopup>
		<AlertComponent />
		</>
	);
};

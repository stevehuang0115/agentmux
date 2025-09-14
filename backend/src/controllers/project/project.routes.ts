import { Router } from 'express';
import type { ApiContext } from '../types.js';
import {
  createProject,
  getProjects,
  getProject,
  getProjectStatus,
  getProjectFiles,
  getFileContent,
  getProjectCompletion,
  deleteProject,
  getProjectContext,
  openProjectInFinder,
  createSpecFile,
  getSpecFileContent,
  getAgentmuxMarkdownFiles,
  saveMarkdownFile,
  startProject,
  stopProject,
  restartProject,
  assignTeamsToProject,
  unassignTeamFromProject,
  getProjectStats,
  getAlignmentStatus,
  continueWithMisalignment
} from './project.controller.js';

/**
 * Creates project router with all project-related endpoints
 * @param context - API context with services
 * @returns Express router configured with project routes
 */
export function createProjectRouter(context: ApiContext): Router {
  const router = Router();

  // Project CRUD operations
  router.post('/', createProject.bind(context));
  router.get('/', getProjects.bind(context));
  router.get('/:id', getProject.bind(context));
  router.delete('/:id', deleteProject.bind(context));

  // Project status and information
  router.get('/:id/status', getProjectStatus.bind(context));
  router.get('/:id/completion', getProjectCompletion.bind(context));
  router.get('/:id/context', getProjectContext.bind(context));
  router.get('/:id/stats', getProjectStats.bind(context));
  router.get('/:id/alignment-status', getAlignmentStatus.bind(context));
  router.post('/:id/continue-with-misalignment', continueWithMisalignment.bind(context));

  // Project lifecycle management
  router.post('/:id/start', startProject.bind(context));
  router.post('/:id/stop', stopProject.bind(context));
  router.post('/:id/restart', restartProject.bind(context));

  // Team assignment
  router.post('/:id/teams', assignTeamsToProject.bind(context));
  router.delete('/:id/teams', unassignTeamFromProject.bind(context));

  // File operations
  router.get('/:id/files', getProjectFiles.bind(context));
  router.get('/:projectId/file-content', getFileContent.bind(context));
  router.post('/:id/open-finder', openProjectInFinder.bind(context));

  // Spec file management
  router.post('/:id/specs', createSpecFile.bind(context));
  router.get('/:id/specs', getSpecFileContent.bind(context));

  // Markdown file operations
  router.get('/markdown-files', getAgentmuxMarkdownFiles.bind(context));
  router.post('/markdown-files', saveMarkdownFile.bind(context));

  return router;
}
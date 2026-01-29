/**
 * Service for managing in-progress tasks data from ~/.agentmux/in_progress_tasks.json
 */

import { TeamMember } from '../types';
import { apiService } from './api.service';

export interface InProgressTask {
  id: string;
  taskPath: string;
  taskName: string;
  assignedSessionName: string;
  assignedMemberId: string;
  assignedAt: string;
  status: 'in_progress';
  originalPath: string;
}

export interface InProgressTasksData {
  tasks: InProgressTask[];
  lastUpdated: string;
  version: string;
}

class InProgressTasksService {
  private cache: InProgressTasksData | null = null;
  private lastCacheTime = 0;
  private readonly cacheTimeout = 30000; // 30 seconds

  /**
   * Load in-progress tasks data from the backend
   */
  async getInProgressTasks(): Promise<InProgressTask[]> {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (this.cache && (now - this.lastCacheTime) < this.cacheTimeout) {
      return this.cache.tasks;
    }

    try {
      const response = await fetch('/api/in-progress-tasks');

      if (!response.ok) {
        console.warn('Failed to fetch in-progress tasks:', response.statusText);
        return this.cache?.tasks || [];
      }

      const data: InProgressTasksData = await response.json();

      // Update cache
      this.cache = data;
      this.lastCacheTime = now;

      return data.tasks;
    } catch (error) {
      console.error('Error loading in-progress tasks:', error);
      return this.cache?.tasks || [];
    }
  }

  /**
   * Get assigned team member for a specific task
   */
  async getTaskAssignedMember(taskPath: string): Promise<InProgressTask | null> {
    const tasks = await this.getInProgressTasks();

    // Try to match by current path or original path
    return tasks.find(task =>
      task.taskPath === taskPath ||
      task.originalPath === taskPath ||
      // Handle path variations (open/in_progress/done folders)
      taskPath.includes(task.taskName) ||
      task.originalPath.includes(taskPath.split('/').pop()?.replace('.md', '') || '')
    ) || null;
  }

  /**
   * Find team member details for an assigned task
   */
  async getTaskAssignedMemberDetails(taskPath: string): Promise<{
    memberName?: string;
    sessionName?: string;
    teamName?: string;
  }> {
    try {
      const inProgressTask = await this.getTaskAssignedMember(taskPath);

      if (!inProgressTask) {
        return {};
      }

      // Fetch team data to get member details (using cached apiService)
      const teams = await apiService.getTeams();

      // Find the team member
      for (const team of teams) {
        if (team.members) {
          const member = team.members.find((m: TeamMember) =>
            m.id === inProgressTask.assignedMemberId ||
            m.sessionName === inProgressTask.assignedSessionName
          );

          if (member) {
            return {
              memberName: member.name,
              sessionName: member.sessionName || inProgressTask.assignedSessionName,
              teamName: team.name
            };
          }
        }
      }

      // Fallback to session name if team member not found
      return {
        sessionName: inProgressTask.assignedSessionName
      };

    } catch (error) {
      console.error('Error getting task assigned member details:', error);
      return {};
    }
  }

  /**
   * Clear the cache (useful for forcing a refresh)
   */
  clearCache(): void {
    this.cache = null;
    this.lastCacheTime = 0;
  }
}

export const inProgressTasksService = new InProgressTasksService();
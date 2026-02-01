/**
 * Tools Index Tests
 *
 * Tests for the tools module exports and tool definitions.
 *
 * @module tools/index.test
 */
import {
  // Role tools
  handleCreateRole,
  handleUpdateRole,
  handleListRoles,
  createRoleToolDefinition,
  updateRoleToolDefinition,
  listRolesToolDefinition,
  // Skill tools
  handleCreateSkill,
  handleExecuteSkill,
  handleListSkills,
  createSkillToolDefinition,
  executeSkillToolDefinition,
  listSkillsToolDefinition,
  // Project tools
  handleCreateProjectFolder,
  handleSetupProjectStructure,
  handleCreateTeamForProject,
  createProjectFolderToolDefinition,
  setupProjectStructureToolDefinition,
  createTeamForProjectToolDefinition,
  // Combined exports
  orchestratorToolDefinitions,
} from './index.js';

describe('Tools Index', () => {
  describe('Exports', () => {
    it('should export all role tool handlers', () => {
      expect(handleCreateRole).toBeDefined();
      expect(typeof handleCreateRole).toBe('function');
      expect(handleUpdateRole).toBeDefined();
      expect(typeof handleUpdateRole).toBe('function');
      expect(handleListRoles).toBeDefined();
      expect(typeof handleListRoles).toBe('function');
    });

    it('should export all skill tool handlers', () => {
      expect(handleCreateSkill).toBeDefined();
      expect(typeof handleCreateSkill).toBe('function');
      expect(handleExecuteSkill).toBeDefined();
      expect(typeof handleExecuteSkill).toBe('function');
      expect(handleListSkills).toBeDefined();
      expect(typeof handleListSkills).toBe('function');
    });

    it('should export all project tool handlers', () => {
      expect(handleCreateProjectFolder).toBeDefined();
      expect(typeof handleCreateProjectFolder).toBe('function');
      expect(handleSetupProjectStructure).toBeDefined();
      expect(typeof handleSetupProjectStructure).toBe('function');
      expect(handleCreateTeamForProject).toBeDefined();
      expect(typeof handleCreateTeamForProject).toBe('function');
    });
  });

  describe('Tool Definitions', () => {
    it('should have valid create_role definition', () => {
      expect(createRoleToolDefinition.name).toBe('create_role');
      expect(createRoleToolDefinition.description).toBeTruthy();
      expect(createRoleToolDefinition.inputSchema.type).toBe('object');
      expect(createRoleToolDefinition.inputSchema.required).toContain('name');
      expect(createRoleToolDefinition.inputSchema.required).toContain('displayName');
      expect(createRoleToolDefinition.inputSchema.required).toContain('category');
    });

    it('should have valid update_role definition', () => {
      expect(updateRoleToolDefinition.name).toBe('update_role');
      expect(updateRoleToolDefinition.description).toBeTruthy();
      expect(updateRoleToolDefinition.inputSchema.type).toBe('object');
      expect(updateRoleToolDefinition.inputSchema.required).toContain('roleId');
    });

    it('should have valid list_roles definition', () => {
      expect(listRolesToolDefinition.name).toBe('list_roles');
      expect(listRolesToolDefinition.description).toBeTruthy();
      expect(listRolesToolDefinition.inputSchema.type).toBe('object');
      expect(listRolesToolDefinition.inputSchema.required).toEqual([]);
    });

    it('should have valid create_skill definition', () => {
      expect(createSkillToolDefinition.name).toBe('create_skill');
      expect(createSkillToolDefinition.description).toBeTruthy();
      expect(createSkillToolDefinition.inputSchema.type).toBe('object');
      expect(createSkillToolDefinition.inputSchema.required).toContain('name');
      expect(createSkillToolDefinition.inputSchema.required).toContain('promptContent');
    });

    it('should have valid execute_skill definition', () => {
      expect(executeSkillToolDefinition.name).toBe('execute_skill');
      expect(executeSkillToolDefinition.description).toBeTruthy();
      expect(executeSkillToolDefinition.inputSchema.type).toBe('object');
      expect(executeSkillToolDefinition.inputSchema.required).toContain('skillId');
    });

    it('should have valid list_skills definition', () => {
      expect(listSkillsToolDefinition.name).toBe('list_skills');
      expect(listSkillsToolDefinition.description).toBeTruthy();
      expect(listSkillsToolDefinition.inputSchema.type).toBe('object');
    });

    it('should have valid create_project_folder definition', () => {
      expect(createProjectFolderToolDefinition.name).toBe('create_project_folder');
      expect(createProjectFolderToolDefinition.description).toBeTruthy();
      expect(createProjectFolderToolDefinition.inputSchema.type).toBe('object');
      expect(createProjectFolderToolDefinition.inputSchema.required).toContain('name');
      expect(createProjectFolderToolDefinition.inputSchema.required).toContain('path');
    });

    it('should have valid setup_project_structure definition', () => {
      expect(setupProjectStructureToolDefinition.name).toBe('setup_project_structure');
      expect(setupProjectStructureToolDefinition.description).toBeTruthy();
      expect(setupProjectStructureToolDefinition.inputSchema.type).toBe('object');
      expect(setupProjectStructureToolDefinition.inputSchema.required).toContain('projectPath');
      expect(setupProjectStructureToolDefinition.inputSchema.required).toContain('structure');
    });

    it('should have valid create_team_for_project definition', () => {
      expect(createTeamForProjectToolDefinition.name).toBe('create_team_for_project');
      expect(createTeamForProjectToolDefinition.description).toBeTruthy();
      expect(createTeamForProjectToolDefinition.inputSchema.type).toBe('object');
      expect(createTeamForProjectToolDefinition.inputSchema.required).toContain('projectId');
      expect(createTeamForProjectToolDefinition.inputSchema.required).toContain('teamName');
      expect(createTeamForProjectToolDefinition.inputSchema.required).toContain('roles');
    });
  });

  describe('orchestratorToolDefinitions', () => {
    it('should export all tool definitions as an array', () => {
      expect(Array.isArray(orchestratorToolDefinitions)).toBe(true);
      expect(orchestratorToolDefinitions.length).toBe(9);
    });

    it('should include all role tool definitions', () => {
      const names = orchestratorToolDefinitions.map((t) => t.name);
      expect(names).toContain('create_role');
      expect(names).toContain('update_role');
      expect(names).toContain('list_roles');
    });

    it('should include all skill tool definitions', () => {
      const names = orchestratorToolDefinitions.map((t) => t.name);
      expect(names).toContain('create_skill');
      expect(names).toContain('execute_skill');
      expect(names).toContain('list_skills');
    });

    it('should include all project tool definitions', () => {
      const names = orchestratorToolDefinitions.map((t) => t.name);
      expect(names).toContain('create_project_folder');
      expect(names).toContain('setup_project_structure');
      expect(names).toContain('create_team_for_project');
    });

    it('should have unique tool names', () => {
      const names = orchestratorToolDefinitions.map((t) => t.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should have valid input schemas for all definitions', () => {
      orchestratorToolDefinitions.forEach((def) => {
        expect(def.inputSchema).toBeDefined();
        expect(def.inputSchema.type).toBe('object');
        expect(def.inputSchema.properties).toBeDefined();
        expect(Array.isArray(def.inputSchema.required)).toBe(true);
      });
    });
  });
});

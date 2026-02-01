/**
 * Project Management Tool Handlers
 *
 * Handles MCP tool calls for project scaffolding operations including
 * creating project folders, setting up project structure, and creating teams.
 *
 * @module tools/project-tools
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  CreateProjectFolderToolParams,
  SetupProjectStructureToolParams,
  CreateTeamForProjectToolParams,
  ToolResultData,
} from '../types.js';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

/**
 * API response wrapper type
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Team data from API
 */
interface TeamData {
  id: string;
  name: string;
  members?: Array<{ id: string }>;
}

/**
 * Handle the create_project_folder MCP tool call
 *
 * Creates a new project directory with optional template and git initialization.
 *
 * @param params - Project folder creation parameters
 * @returns Tool result with created project path
 *
 * @example
 * ```typescript
 * const result = await handleCreateProjectFolder({
 *   name: 'my-app',
 *   path: '/home/user/projects',
 *   template: 'typescript',
 *   initGit: true,
 * });
 * ```
 */
export async function handleCreateProjectFolder(
  params: CreateProjectFolderToolParams
): Promise<ToolResultData> {
  try {
    const projectPath = path.join(params.path, params.name);

    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });

    // Apply template if specified
    if (params.template && params.template !== 'empty') {
      await applyProjectTemplate(projectPath, params.template);
    }

    // Initialize git if requested
    if (params.initGit) {
      await initGitRepository(projectPath);
    }

    return {
      success: true,
      message: `Project "${params.name}" created at ${projectPath}`,
      projectPath,
      template: params.template || 'empty',
      gitInitialized: params.initGit || false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating project folder',
    };
  }
}

/**
 * Handle the setup_project_structure MCP tool call
 *
 * Sets up project structure with specified folders and files.
 *
 * @param params - Project structure setup parameters
 * @returns Tool result with counts of created items
 *
 * @example
 * ```typescript
 * const result = await handleSetupProjectStructure({
 *   projectPath: '/home/user/projects/my-app',
 *   structure: {
 *     folders: ['src', 'tests', 'docs'],
 *     files: [
 *       { path: 'README.md', content: '# My App' },
 *       { path: 'src/index.ts', content: 'console.log("Hello");' },
 *     ],
 *   },
 * });
 * ```
 */
export async function handleSetupProjectStructure(
  params: SetupProjectStructureToolParams
): Promise<ToolResultData> {
  try {
    const { projectPath, structure } = params;

    // Verify project path exists
    try {
      await fs.access(projectPath);
    } catch {
      return {
        success: false,
        error: `Project path does not exist: ${projectPath}`,
      };
    }

    let foldersCreated = 0;
    let filesCreated = 0;

    // Create folders
    if (structure.folders) {
      for (const folder of structure.folders) {
        const folderPath = path.join(projectPath, folder);
        await fs.mkdir(folderPath, { recursive: true });
        foldersCreated++;
      }
    }

    // Create files
    if (structure.files) {
      for (const file of structure.files) {
        const filePath = path.join(projectPath, file.path);
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
        filesCreated++;
      }
    }

    return {
      success: true,
      message: 'Project structure created successfully',
      foldersCreated,
      filesCreated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error setting up project structure',
    };
  }
}

/**
 * Handle the create_team_for_project MCP tool call
 *
 * Creates a new team configured for a specific project.
 *
 * @param params - Team creation parameters
 * @returns Tool result with created team information
 *
 * @example
 * ```typescript
 * const result = await handleCreateTeamForProject({
 *   projectId: 'project-123',
 *   teamName: 'My Project Team',
 *   roles: ['developer', 'qa', 'designer'],
 *   agentCount: { developer: 2, qa: 1, designer: 1 },
 * });
 * ```
 */
export async function handleCreateTeamForProject(
  params: CreateTeamForProjectToolParams
): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.teamName,
        description: `Team for project ${params.projectId}`,
        currentProject: params.projectId,
        roles: params.roles,
        agentCount: params.agentCount,
      }),
    });

    const data = (await response.json()) as ApiResponse<TeamData>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to create team: ${response.statusText}`,
      };
    }

    const teamData = data.data;
    if (!teamData) {
      return {
        success: false,
        error: 'No team data returned from server',
      };
    }

    return {
      success: true,
      message: `Team "${params.teamName}" created for project ${params.projectId}`,
      team: {
        id: teamData.id,
        name: teamData.name,
        memberCount: teamData.members?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating team',
    };
  }
}

/**
 * Apply a project template to the given directory
 *
 * @param projectPath - Path to the project directory
 * @param template - Template type to apply
 */
async function applyProjectTemplate(projectPath: string, template: string): Promise<void> {
  const templates: Record<string, () => Promise<void>> = {
    typescript: () => createTypescriptTemplate(projectPath),
    react: () => createReactTemplate(projectPath),
    node: () => createNodeTemplate(projectPath),
    python: () => createPythonTemplate(projectPath),
  };

  if (templates[template]) {
    await templates[template]();
  }
}

/**
 * Create a basic TypeScript project structure
 *
 * @param projectPath - Path to the project directory
 */
async function createTypescriptTemplate(projectPath: string): Promise<void> {
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(
      {
        name: path.basename(projectPath),
        version: '1.0.0',
        type: 'module',
        scripts: {
          build: 'tsc',
          start: 'node dist/index.js',
          dev: 'tsc --watch',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          outDir: './dist',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
        include: ['src/**/*'],
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(projectPath, 'src', 'index.ts'),
    'console.log("Hello, World!");\n'
  );
}

/**
 * Create a basic React project structure
 *
 * @param projectPath - Path to the project directory
 */
async function createReactTemplate(projectPath: string): Promise<void> {
  await fs.mkdir(path.join(projectPath, 'src', 'components'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'public'), { recursive: true });

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(
      {
        name: path.basename(projectPath),
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.0.0',
          typescript: '^5.0.0',
          vite: '^5.0.0',
        },
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(projectPath, 'src', 'App.tsx'),
    `function App() {
  return (
    <div>
      <h1>Hello, React!</h1>
    </div>
  );
}

export default App;
`
  );

  await fs.writeFile(
    path.join(projectPath, 'src', 'main.tsx'),
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
  );

  await fs.writeFile(
    path.join(projectPath, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${path.basename(projectPath)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  );
}

/**
 * Create a basic Node.js project structure
 *
 * @param projectPath - Path to the project directory
 */
async function createNodeTemplate(projectPath: string): Promise<void> {
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(
      {
        name: path.basename(projectPath),
        version: '1.0.0',
        type: 'module',
        main: 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          dev: 'node --watch src/index.js',
        },
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(projectPath, 'src', 'index.js'),
    'console.log("Hello, Node.js!");\n'
  );
}

/**
 * Create a basic Python project structure
 *
 * @param projectPath - Path to the project directory
 */
async function createPythonTemplate(projectPath: string): Promise<void> {
  const projectName = path.basename(projectPath).replace(/-/g, '_');

  await fs.mkdir(path.join(projectPath, projectName), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'tests'), { recursive: true });

  await fs.writeFile(
    path.join(projectPath, 'pyproject.toml'),
    `[project]
name = "${projectName}"
version = "1.0.0"
description = ""
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
`
  );

  await fs.writeFile(path.join(projectPath, projectName, '__init__.py'), '');

  await fs.writeFile(
    path.join(projectPath, projectName, 'main.py'),
    `def main():
    print("Hello, Python!")

if __name__ == "__main__":
    main()
`
  );

  await fs.writeFile(path.join(projectPath, 'tests', '__init__.py'), '');

  await fs.writeFile(
    path.join(projectPath, 'tests', 'test_main.py'),
    `def test_placeholder():
    assert True
`
  );
}

/**
 * Initialize a git repository in the given directory
 *
 * @param projectPath - Path to the project directory
 */
async function initGitRepository(projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['init'], { cwd: projectPath });

    git.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git init failed with code ${code}`));
      }
    });

    git.on('error', (error) => {
      reject(error);
    });
  });
}

import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import open from 'open';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';
import {
  ORCHESTRATOR_SETUP_TIMEOUT,
  DEFAULT_WEB_PORT,
  API_ENDPOINTS,
  CREWLY_HOME_DIR
} from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StartOptions {
	port?: string;
	browser?: boolean;
}

export async function startCommand(options: StartOptions) {
	const webPort = parseInt(options.port || DEFAULT_WEB_PORT.toString());
	const openBrowser = options.browser !== false;

	console.log(chalk.blue('🚀 Starting Crewly...'));
	console.log(chalk.gray(`Web Port: ${webPort}`));

	try {
		// 1. Ensure ~/.crewly directory exists
		await ensureCrewlyHome();

		// 2. Check if services are already running
		const alreadyRunning = await checkIfRunning(webPort);
		if (alreadyRunning) {
			console.log(chalk.yellow('⚠️  Crewly is already running'));
			if (openBrowser) {
				console.log(chalk.blue('🌐 Opening dashboard...'));
				await open(`http://localhost:${webPort}`);
			}
			return;
		}

		// 3. Start backend server
		console.log(chalk.blue('📡 Starting backend server...'));
		const backendProcess = await startBackendServer(webPort);

		// 4. Wait for servers to be ready
		console.log(chalk.blue('⏳ Waiting for servers to initialize...'));
		await waitForServer(webPort);

		// 5. Setup orchestrator session (non-blocking)
		setupOrchestratorSessionAsync(webPort);

		// 6. Open browser to dashboard immediately
		if (openBrowser) {
			console.log(chalk.blue('🌐 Opening dashboard...'));
			await open(`http://localhost:${webPort}`);
		}

		console.log(chalk.green('✅ Crewly started successfully!'));
		console.log(chalk.cyan(`📊 Dashboard: http://localhost:${webPort}`));
		console.log(chalk.cyan(`⚡ WebSocket: ws://localhost:${webPort}`));
		console.log(chalk.gray(`🎯 Orchestrator: Setting up in background...`));
		console.log('');
		console.log(chalk.yellow('Press Ctrl+C to stop all services'));

		// 7. Monitor for shutdown signals
		setupShutdownHandlers([backendProcess]);

		// Keep process alive
		await new Promise(() => {}); // Wait forever
	} catch (error) {
		console.error(
			chalk.red('❌ Failed to start Crewly:'),
			error instanceof Error ? error.message : error
		);
		process.exit(1);
	}
}

async function setupOrchestratorSession(webPort: number): Promise<void> {
	try {
		// Call the backend API to setup orchestrator session
		const response = await axios.post(
			`http://localhost:${webPort}${API_ENDPOINTS.ORCHESTRATOR_SETUP}`,
			{},
			{
				timeout: ORCHESTRATOR_SETUP_TIMEOUT
			}
		);

		if (response.data.success) {
			console.log(chalk.green('✅ Orchestrator session ready'));
		} else {
			console.log(
				chalk.yellow(
					`⚠️  Orchestrator setup warning: ${response.data.message || 'Unknown issue'}`
				)
			);
		}
	} catch (error) {
		console.log(
			chalk.yellow(
				'⚠️  Could not setup orchestrator session - it will be created when needed'
			)
		);
		console.log(
			chalk.gray(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
		);
	}
}

/**
 * Setup orchestrator session asynchronously (fire-and-forget)
 * This allows the browser to open immediately while orchestrator initializes in background
 */
function setupOrchestratorSessionAsync(webPort: number): void {
	// Don't await this - let it run in background
	setupOrchestratorSession(webPort)
		.then(() => {
			// Success message already logged in setupOrchestratorSession
		})
		.catch((error) => {
			// Error message already logged in setupOrchestratorSession
			// Just ensure the process doesn't crash
			console.log(chalk.gray('🎯 Orchestrator setup completed (check messages above)'));
		});
}

async function ensureCrewlyHome(): Promise<void> {
	const crewlyHome = path.join(os.homedir(), CREWLY_HOME_DIR);

	if (!fs.existsSync(crewlyHome)) {
		fs.mkdirSync(crewlyHome, { recursive: true });
		console.log(chalk.green(`📁 Created Crewly home: ${crewlyHome}`));
	}

	// Create default config if it doesn't exist
	const configPath = path.join(crewlyHome, 'config.env');
	if (!fs.existsSync(configPath)) {
		const defaultConfig = `WEB_PORT=${DEFAULT_WEB_PORT}
CREWLY_HOME=${crewlyHome}
DEFAULT_CHECK_INTERVAL=30
AUTO_COMMIT_INTERVAL=30`;
		fs.writeFileSync(configPath, defaultConfig);
		console.log(chalk.green(`⚙️  Created default config: ${configPath}`));
	}
}

async function checkIfRunning(port: number): Promise<boolean> {
	try {
		const response = await axios.get(`http://localhost:${port}/health`, { timeout: 2000 });
		return response.status === 200;
	} catch (error) {
		return false;
	}
}

async function startBackendServer(webPort: number): Promise<ChildProcess> {
	// Get the project root directory (go up from dist/cli/commands to the root)
	const projectRoot = path.resolve(__dirname, '../../../');

	const env = {
		...process.env,
		WEB_PORT: webPort.toString(),
		NODE_ENV: process.env.NODE_ENV || 'development',
	};

	const backendProcess = spawn(
		'node',
		[
			'--expose-gc',
			'--max-old-space-size=2048',
			path.join(projectRoot, 'dist/backend/backend/src/index.js'),
		],
		{
			env,
			stdio: 'pipe',
			detached: false,
			cwd: projectRoot,
		}
	);

	backendProcess.stdout?.on('data', (data) => {
		const output = data.toString().trim();
		if (output) {
			console.log(chalk.gray(`[Backend] ${output}`));
		}
	});

	backendProcess.stderr?.on('data', (data) => {
		const output = data.toString().trim();
		if (output) {
			console.error(chalk.red(`[Backend Error] ${output}`));
		}
	});

	backendProcess.on('error', (error) => {
		console.error(chalk.red('Backend process error:'), error);
	});

	backendProcess.on('exit', (code, signal) => {
		if (code !== 0) {
			console.error(
				chalk.red(`Backend process exited with code ${code} (signal: ${signal})`)
			);
		}
	});

	return backendProcess;
}

async function waitForServer(port: number, maxAttempts: number = 30): Promise<void> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
			return;
		} catch (error) {
			if (i === maxAttempts - 1) {
				throw new Error('Server failed to start within timeout');
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
}

function setupShutdownHandlers(processes: ChildProcess[]): void {
	const cleanup = () => {
		console.log(chalk.yellow('\n🛑 Shutting down Crewly...'));

		processes.forEach((process) => {
			if (process && !process.killed) {
				console.log(chalk.gray(`Stopping Backend server...`));
				process.kill('SIGTERM');

				// Force kill after 5 seconds
				setTimeout(() => {
					if (!process.killed) {
						process.kill('SIGKILL');
					}
				}, 5000);
			}
		});

		setTimeout(() => {
			console.log(chalk.green('✅ Crewly stopped'));
			process.exit(0);
		}, 1000);
	};

	process.on('SIGTERM', cleanup);
	process.on('SIGINT', cleanup);
	process.on('SIGUSR1', cleanup);
	process.on('SIGUSR2', cleanup);
}

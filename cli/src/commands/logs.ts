import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface LogsOptions {
  follow?: boolean;
  lines?: string;
}

export async function logsCommand(options: LogsOptions) {
  const numLines = parseInt(options.lines || '50');
  
  console.log(chalk.blue(`📄 AgentMux Logs (last ${numLines} lines)`));
  console.log(chalk.gray('='.repeat(60)));

  try {
    const agentmuxHome = path.join(os.homedir(), '.agentmux');
    
    // Show different types of logs
    await showProjectLogs(agentmuxHome, numLines);
    await showCommunicationLogs(agentmuxHome, numLines);
    await showSchedulerLogs(agentmuxHome, numLines);
    
    // If follow mode, tail the logs
    if (options.follow) {
      console.log(chalk.yellow('\n👁️  Following logs (Ctrl+C to stop)...'));
      await followLogs(agentmuxHome);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error reading logs:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showProjectLogs(agentmuxHome: string, lines: number): Promise<void> {
  try {
    // Find all project communication logs
    const projects = await findProjectDirectories();
    
    for (const projectPath of projects.slice(0, 3)) { // Limit to 3 most recent
      const logPath = path.join(projectPath, '.agentmux', 'memory', 'communication.log');
      
      if (fs.existsSync(logPath)) {
        console.log(chalk.cyan(`\n📁 Project: ${path.basename(projectPath)}`));
        
        try {
          const { stdout } = await execAsync(`tail -n ${Math.floor(lines / 2)} "${logPath}" 2>/dev/null || echo "No logs"`);
          
          if (stdout.trim()) {
            const logLines = stdout.trim().split('\n');
            logLines.forEach(line => {
              if (line.includes('->')) {
                console.log(chalk.gray(`   ${line}`));
              }
            });
          }
        } catch (error) {
          console.log(chalk.gray('   No communication logs'));
        }
      }
    }
  } catch (error) {
    console.log(chalk.gray('No project logs found'));
  }
}

async function showCommunicationLogs(agentmuxHome: string, lines: number): Promise<void> {
  console.log(chalk.cyan('\n💬 Recent Communication:'));
  
  try {
    // Look for global communication logs
    const globalLogPath = path.join(agentmuxHome, 'communication.log');
    
    if (fs.existsSync(globalLogPath)) {
      const { stdout } = await execAsync(`tail -n ${lines} "${globalLogPath}" 2>/dev/null || echo "No logs"`);
      
      if (stdout.trim()) {
        const logLines = stdout.trim().split('\n');
        logLines.forEach(line => {
          if (line.includes('STATUS UPDATE')) {
            console.log(chalk.green(`   ${line}`));
          } else if (line.includes('ERROR') || line.includes('FAILED')) {
            console.log(chalk.red(`   ${line}`));
          } else {
            console.log(chalk.gray(`   ${line}`));
          }
        });
      } else {
        console.log(chalk.gray('   No communication logs'));
      }
    } else {
      console.log(chalk.gray('   No global communication logs'));
    }
  } catch (error) {
    console.log(chalk.gray('   Unable to read communication logs'));
  }
}

async function showSchedulerLogs(agentmuxHome: string, lines: number): Promise<void> {
  console.log(chalk.cyan('\n⏰ Scheduler Activity:'));
  
  try {
    // Look for scheduler logs
    const schedulerLogPath = path.join(agentmuxHome, 'scheduler.log');
    
    if (fs.existsSync(schedulerLogPath)) {
      const { stdout } = await execAsync(`tail -n ${Math.floor(lines / 2)} "${schedulerLogPath}" 2>/dev/null || echo "No logs"`);
      
      if (stdout.trim()) {
        const logLines = stdout.trim().split('\n');
        logLines.forEach(line => {
          if (line.includes('Scheduled')) {
            console.log(chalk.blue(`   ${line}`));
          } else if (line.includes('Executed')) {
            console.log(chalk.green(`   ${line}`));
          } else {
            console.log(chalk.gray(`   ${line}`));
          }
        });
      } else {
        console.log(chalk.gray('   No scheduler logs'));
      }
    } else {
      console.log(chalk.gray('   No scheduler logs'));
    }
  } catch (error) {
    console.log(chalk.gray('   Unable to read scheduler logs'));
  }
}

async function followLogs(agentmuxHome: string): Promise<void> {
  // This would implement log following in a real scenario
  // For now, we'll just show a simulation
  
  const logFiles = [
    path.join(agentmuxHome, 'communication.log'),
    path.join(agentmuxHome, 'scheduler.log')
  ];
  
  // Find project logs
  const projects = await findProjectDirectories();
  for (const projectPath of projects.slice(0, 2)) {
    const commLogPath = path.join(projectPath, '.agentmux', 'memory', 'communication.log');
    if (fs.existsSync(commLogPath)) {
      logFiles.push(commLogPath);
    }
  }
  
  if (logFiles.length === 0) {
    console.log(chalk.yellow('No log files to follow'));
    return;
  }
  
  // Use tail -f to follow multiple files
  const tailProcess = spawn('tail', ['-f', ...logFiles.filter(f => fs.existsSync(f))], {
    stdio: 'pipe'
  });
  
  tailProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      // Color code the output
      const lines = output.split('\n');
      lines.forEach((line: string) => {
        if (line.includes('ERROR') || line.includes('FAILED')) {
          console.log(chalk.red(line));
        } else if (line.includes('STATUS UPDATE')) {
          console.log(chalk.green(line));
        } else if (line.includes('Scheduled')) {
          console.log(chalk.blue(line));
        } else {
          console.log(chalk.gray(line));
        }
      });
    }
  });
  
  tailProcess.stderr?.on('data', (data) => {
    console.error(chalk.red(`[Tail Error] ${data.toString().trim()}`));
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    tailProcess.kill('SIGTERM');
    console.log(chalk.yellow('\n🛑 Stopped following logs'));
    process.exit(0);
  });
  
  // Wait for tail process
  await new Promise((resolve, reject) => {
    tailProcess.on('close', resolve);
    tailProcess.on('error', reject);
  });
}

async function findProjectDirectories(): Promise<string[]> {
  try {
    const agentmuxHome = path.join(os.homedir(), '.agentmux');
    const projectsFile = path.join(agentmuxHome, 'projects.json');
    
    if (!fs.existsSync(projectsFile)) {
      return [];
    }
    
    const content = fs.readFileSync(projectsFile, 'utf-8');
    const projects = JSON.parse(content);
    
    return projects.map((p: any) => p.path).filter((p: string) => fs.existsSync(p));
  } catch (error) {
    return [];
  }
}
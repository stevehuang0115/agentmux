import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import axios from 'axios';

const execAsync = promisify(exec);

interface StatusOptions {
  verbose?: boolean;
}

export async function statusCommand(options: StatusOptions) {
  console.log(chalk.blue('🔍 AgentMux Status'));
  console.log(chalk.gray('='.repeat(50)));

  try {
    // Check backend server
    await checkBackendStatus();
    
    // Check tmux sessions
    await checkTmuxSessions(options.verbose);
    
    // Check running processes
    if (options.verbose) {
      await checkRunningProcesses();
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking status:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function checkBackendStatus(): Promise<void> {
  try {
    const response = await axios.get('http://localhost:3000/health', { timeout: 3000 });
    
    if (response.status === 200) {
      console.log(chalk.green('✅ Backend Server: Running'));
      console.log(chalk.gray(`   URL: http://localhost:3000`));
      console.log(chalk.gray(`   Uptime: ${Math.round(response.data.uptime || 0)}s`));
      console.log(chalk.gray(`   Version: ${response.data.version || 'unknown'}`));
      
      // Try to get teams data
      try {
        const teamsResponse = await axios.get('http://localhost:3000/api/teams', { timeout: 2000 });
        if (teamsResponse.data.success) {
          const teams = teamsResponse.data.data || [];
          console.log(chalk.gray(`   Active Teams: ${teams.length}`));
        }
      } catch (error) {
        console.log(chalk.yellow('   ⚠️  API not fully available'));
      }
    }
  } catch (error) {
    console.log(chalk.red('❌ Backend Server: Not Running'));
    console.log(chalk.gray('   Run "npx agentmux start" to start the server'));
  }
}

async function checkTmuxSessions(verbose: boolean = false): Promise<void> {
  try {
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_attached}:#{session_created}" 2>/dev/null || echo ""');
    
    if (!stdout.trim()) {
      console.log(chalk.yellow('⚠️  Tmux: No sessions running'));
      return;
    }
    
    const sessions = stdout.trim().split('\n');
    const agentMuxSessions = sessions.filter(s => s.includes('agentmux_'));
    
    console.log(chalk.green(`✅ Tmux: ${sessions.length} total sessions`));
    console.log(chalk.gray(`   AgentMux sessions: ${agentMuxSessions.length}`));
    
    if (verbose && agentMuxSessions.length > 0) {
      console.log(chalk.gray('\n   AgentMux Sessions:'));
      
      for (const session of agentMuxSessions) {
        const [name, attached, created] = session.split(':');
        const createdDate = new Date(parseInt(created) * 1000);
        
        console.log(chalk.gray(`   • ${name}`));
        console.log(chalk.gray(`     Attached: ${attached === '1' ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`     Created: ${createdDate.toLocaleString()}`));
        
        // Try to capture recent output
        try {
          const { stdout: output } = await execAsync(`tmux capture-pane -t "${name}:0" -p -S -5 2>/dev/null || echo "No output"`);
          const lastLine = output.trim().split('\n').pop() || 'No recent activity';
          console.log(chalk.gray(`     Last: ${lastLine.slice(0, 60)}${lastLine.length > 60 ? '...' : ''}`));
        } catch (error) {
          console.log(chalk.gray('     Last: Unable to capture'));
        }
        
        console.log('');
      }
    }
    
  } catch (error) {
    console.log(chalk.red('❌ Tmux: Not available'));
    console.log(chalk.gray('   Install tmux to use AgentMux session management'));
  }
}

async function checkRunningProcesses(): Promise<void> {
  try {
    console.log(chalk.blue('\n🔍 Running Processes:'));
    
    // Check for Node.js processes related to AgentMux
    const { stdout } = await execAsync('ps aux | grep -E "(agentmux|backend|mcp-server)" | grep -v grep || echo ""');
    
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      console.log(chalk.gray(`   Found ${lines.length} related processes:`));
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 10) {
          const pid = parts[1];
          const cpu = parts[2];
          const mem = parts[3];
          const command = parts.slice(10).join(' ').slice(0, 80);
          
          console.log(chalk.gray(`   • PID ${pid} (CPU: ${cpu}%, MEM: ${mem}%)`));
          console.log(chalk.gray(`     ${command}${command.length >= 80 ? '...' : ''}`));
        }
      }
    } else {
      console.log(chalk.gray('   No AgentMux processes found'));
    }
    
    // Check port usage
    try {
      const { stdout: portCheck } = await execAsync('lsof -i :3000,3001 2>/dev/null || echo ""');
      if (portCheck.trim()) {
        console.log(chalk.blue('\n🔌 Port Usage:'));
        console.log(chalk.gray(portCheck.trim()));
      }
    } catch (error) {
      // lsof might not be available
    }
    
  } catch (error) {
    console.log(chalk.yellow('⚠️  Unable to check running processes'));
  }
}
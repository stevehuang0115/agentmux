#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 Starting AgentMux...\n');

// Create required directories
const dirs = ['scripts'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Generate send-claude-message.sh script
const sendClaudeScript = `#!/bin/bash

# AgentMux - Send Claude Message Script
# Usage: ./send-claude-message.sh <target> "message"
# Example: ./send-claude-message.sh session:0 "Hello Claude!"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <target> \"message\""
    echo "Example: $0 session:0 \"Hello Claude!\""
    exit 1
fi

TARGET="$1"
MESSAGE="$2"

# Validate target format
if [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+$ ]]; then
    echo "❌ Invalid target format. Use: session:window or session:window.pane"
    exit 1
fi

echo "📤 Sending message to $TARGET..."

# Send message to tmux
tmux send-keys -t "$TARGET" "$MESSAGE"
sleep 0.5
tmux send-keys -t "$TARGET" Enter

echo "✅ Message sent successfully"
`;

// Generate schedule_with_note.sh script
const scheduleScript = `#!/bin/bash

# AgentMux - Schedule with Note Script
# Usage: ./schedule_with_note.sh <minutes> "<note>" [target_window]

if [ $# -lt 2 ]; then
    echo "Usage: $0 <minutes> \"<note>\" [target_window]"
    echo "Example: $0 15 \"Check agent progress\" tmux-orc:0"
    exit 1
fi

MINUTES="$1"
NOTE="$2"
TARGET_WINDOW="\${3:-tmux-orc:0}"

# Validate minutes is a number
if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
    echo "❌ Minutes must be a number"
    exit 1
fi

# Check if target window exists (skip check for now to avoid blocking)
echo "⏰ Scheduling reminder for $MINUTES minutes: $NOTE"
echo "   Target: $TARGET_WINDOW"

# Create the scheduled command
COMMAND="./send-claude-message.sh '$TARGET_WINDOW' '⏰ SCHEDULED REMINDER: $NOTE'"

# Schedule using background process (cross-platform)
(
    sleep $((MINUTES * 60))
    eval "$COMMAND" 2>/dev/null || echo "⚠️ Could not deliver scheduled message to $TARGET_WINDOW"
) &

echo "✅ Reminder scheduled for $MINUTES minutes from now (PID: $!)"
`;

// Write scripts
fs.writeFileSync('./send-claude-message.sh', sendClaudeScript, { mode: 0o755 });
fs.writeFileSync('./schedule_with_note.sh', scheduleScript, { mode: 0o755 });

console.log('✅ Generated send-claude-message.sh');
console.log('✅ Generated schedule_with_note.sh');
console.log('');

// Install dependencies if needed
console.log('🔍 Checking dependencies...');
if (!fs.existsSync('./node_modules') || !fs.existsSync('./frontend/node_modules')) {
  console.log('📦 Installing dependencies...');
  
  const installMain = spawn('npm', ['install'], { stdio: 'inherit' });
  installMain.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Failed to install main dependencies');
      process.exit(1);
    }
    
    const installFrontend = spawn('npm', ['install'], { 
      cwd: './frontend',
      stdio: 'inherit' 
    });
    
    installFrontend.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Failed to install frontend dependencies');
        process.exit(1);
      }
      startBuild();
    });
  });
} else {
  startBuild();
}

function startBuild() {
  // Auto-start server
  console.log('🔧 Building AgentMux server...');
  const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'pipe' });

  let buildOutput = '';
  buildProcess.stdout?.on('data', (data) => {
    buildOutput += data.toString();
  });
  
  buildProcess.stderr?.on('data', (data) => {
    console.error(data.toString());
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completed');
      console.log('🚀 Starting AgentMux server...');
      
      // Start the server
      const server = spawn('npm', ['start'], { 
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false 
      });

      // Auto-open browser after server starts
      setTimeout(() => {
        const url = 'http://localhost:3001';
        const start = (process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open');
        
        console.log(`\n🌐 Opening browser: ${url}\n`);
        console.log('📋 AgentMux Dashboard Features:');
        console.log('   • Real-time terminal streaming');
        console.log('   • Live session monitoring');
        console.log('   • Interactive command execution');
        console.log('   • Multi-window session management\n');
        
        spawn(start, [url], { stdio: 'ignore', detached: true });
      }, 3000);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down AgentMux...');
        server.kill('SIGTERM');
        process.exit(0);
      });

      server.on('close', (code) => {
        console.log(`AgentMux server exited with code ${code}`);
        process.exit(code);
      });

    } else {
      console.error('❌ Build failed');
      console.error('Build output:', buildOutput);
      process.exit(1);
    }
  });
}
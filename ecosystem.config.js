module.exports = {
	apps: [
		{
			name: 'agentmux-server',
			script: 'backend/dist/server.js',
			cwd: '/app',
			instances: 1,
			exec_mode: 'cluster',
			watch: false,
			max_memory_restart: '512M',
			env: {
				NODE_ENV: 'production',
				PORT: 3000,
				AGENTMUX_MCP_PORT: 3001,
				DATA_PATH: '/app/data',
				LOG_DIR: '/app/logs',
			},
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			error_file: '/app/logs/agentmux-error.log',
			out_file: '/app/logs/agentmux-out.log',
			log_file: '/app/logs/agentmux-combined.log',
			pid_file: '/app/logs/agentmux.pid',
			// Restart policy
			min_uptime: '10s',
			max_restarts: 10,
			restart_delay: 4000,
			// Health monitoring
			health_check_http: {
				port: 3000,
				path: '/health',
				interval: 30000,
				timeout: 5000,
			},
			// Auto restart on memory usage
			max_memory_restart: '512M',
			// Kill timeout
			kill_timeout: 5000,
			// Graceful shutdown
			wait_ready: true,
			listen_timeout: 10000,
		},
		{
			name: 'agentmux-mcp',
			script: 'mcp-server/dist/mcp-process-recovery.js',
			cwd: '/app',
			instances: 1,
			exec_mode: 'fork',
			watch: false,
			max_memory_restart: '256M',
			env: {
				NODE_ENV: 'production',
				AGENTMUX_MCP_PORT: 3001,
				DATA_PATH: '/app/data',
				LOG_DIR: '/app/logs',
			},
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			error_file: '/app/logs/mcp-error.log',
			out_file: '/app/logs/mcp-out.log',
			log_file: '/app/logs/mcp-combined.log',
			pid_file: '/app/logs/mcp.pid',
			// Restart policy
			min_uptime: '10s',
			max_restarts: 10,
			restart_delay: 4000,
			// Kill timeout
			kill_timeout: 5000,
		},
	],

	// Deployment configuration
	deploy: {
		production: {
			user: 'deploy',
			host: ['your-server.com'],
			ref: 'origin/main',
			repo: 'https://github.com/your-username/agentmux.git',
			path: '/var/www/agentmux',
			'pre-setup': 'apt-get update && apt-get install -y git tmux',
			'post-setup': 'npm install && npm run build',
			'pre-deploy-local': '',
			'post-deploy':
				'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
			'pre-setup': 'npm install pm2 -g',
		},
	},
};

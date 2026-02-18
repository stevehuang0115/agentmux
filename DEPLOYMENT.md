# Crewly Deployment Guide

This guide covers various deployment options for Crewly in production environments.

## Quick Start Options

### 1. Docker Compose (Recommended)

The easiest way to deploy Crewly with all dependencies:

```bash
# Clone the repository
git clone <repository-url>
cd crewly

# Start with Docker Compose
npm run docker:compose:up

# View logs
npm run docker:compose:logs

# Stop services
npm run docker:compose:down
```

Services will be available at:

-   **Crewly Web UI**: http://localhost:3000
-   **MCP Server**: http://localhost:3001
-   **Health Check**: http://localhost:3000/health

### 2. Docker Only

Build and run just the Crewly container:

```bash
# Build the Docker image
npm run docker:build

# Run the container
npm run docker:run
```

### 3. PM2 Process Manager

For traditional server deployments:

```bash
# Install dependencies and build
npm install
npm run build

# Install PM2 globally
npm install -g pm2

# Start with PM2
npm run start:pm2

# Monitor processes
npm run monit:pm2

# View logs
npm run logs:pm2
```

## Environment Configuration

### Required Environment Variables

```bash
NODE_ENV=production
PORT=3000
CREWLY_MCP_PORT=3001
SESSION_SECRET=your-secure-secret-key-here
```

### Optional Configuration

```bash
# Data and logging
DATA_PATH=/app/data
LOG_DIR=/app/logs
LOG_LEVEL=info

# CORS settings
CORS_ORIGIN=http://localhost:3000,https://your-domain.com

# Error tracking
ERROR_TRACKING_MAX_STORED=1000
ERROR_TRACKING_RETENTION_HOURS=24

# Performance
MAX_CONCURRENT_AGENTS=50
AGENT_DEFAULT_TIMEOUT=300000

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# Git integration
GIT_AUTO_COMMIT=false
GIT_DEFAULT_BRANCH=main

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
```

## Production Deployment

### 1. Server Requirements

**Minimum Requirements:**

-   CPU: 2 cores
-   RAM: 4GB
-   Storage: 20GB
-   Node.js: 18.x or higher
-   Git, tmux, bash

**Recommended:**

-   CPU: 4 cores
-   RAM: 8GB
-   Storage: 50GB SSD

### 2. Docker Compose Production Setup

Create a production `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
    crewly:
        build: .
        restart: unless-stopped
        ports:
            - '80:3000'
            - '3001:3001'
        environment:
            - NODE_ENV=production
            - SESSION_SECRET=${SESSION_SECRET}
            - CORS_ORIGIN=${CORS_ORIGIN}
        volumes:
            - crewly_data:/app/data
            - crewly_logs:/app/logs
        depends_on:
            - redis
            - postgres

    redis:
        image: redis:7-alpine
        restart: unless-stopped
        volumes:
            - redis_data:/data
        command: redis-server --requirepass ${REDIS_PASSWORD}

    postgres:
        image: postgres:15-alpine
        restart: unless-stopped
        environment:
            - POSTGRES_DB=${POSTGRES_DB}
            - POSTGRES_USER=${POSTGRES_USER}
            - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
        volumes:
            - postgres_data:/var/lib/postgresql/data

    nginx:
        image: nginx:alpine
        restart: unless-stopped
        ports:
            - '443:443'
        volumes:
            - ./nginx.conf:/etc/nginx/nginx.conf
            - ./ssl:/etc/nginx/ssl
        depends_on:
            - crewly

volumes:
    crewly_data:
    crewly_logs:
    redis_data:
    postgres_data:
```

Deploy with:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. PM2 Cluster Mode

For high-availability deployment:

```javascript
// ecosystem.prod.js
module.exports = {
	apps: [
		{
			name: 'crewly-cluster',
			script: 'backend/dist/server.js',
			instances: 'max', // Use all CPU cores
			exec_mode: 'cluster',
			env_production: {
				NODE_ENV: 'production',
				PORT: 3000,
				// ... other environment variables
			},
		},
	],
};
```

Deploy:

```bash
pm2 start ecosystem.prod.js --env production
pm2 save
pm2 startup
```

## Monitoring & Logging

### Health Checks

Crewly provides built-in health endpoints:

-   **Basic Health**: `GET /health`
-   **Detailed Health**: `GET /api/system/health`
-   **Metrics**: `GET /api/system/metrics`

### Log Management

Logs are written to:

-   **Application**: `/app/logs/crewly-combined.log`
-   **Errors**: `/app/logs/crewly-error.log`
-   **MCP Server**: `/app/logs/mcp-combined.log`

Configure log rotation:

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Monitoring Integration

#### Prometheus Metrics

```yaml
# Add to docker-compose.yml
prometheus:
    image: prom/prometheus
    ports:
        - '9090:9090'
    volumes:
        - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
    image: grafana/grafana
    ports:
        - '3001:3000'
    environment:
        - GF_SECURITY_ADMIN_PASSWORD=admin
```

#### Health Check Monitoring

```bash
# Simple health check script
#!/bin/bash
while true; do
  if ! curl -f http://localhost:3000/health; then
    echo "Health check failed at $(date)"
    # Send alert or restart service
  fi
  sleep 30
done
```

## Security Considerations

### 1. Environment Variables

-   Use `.env` files or container secrets
-   Never commit secrets to version control
-   Rotate secrets regularly

### 2. Network Security

-   Use HTTPS in production
-   Configure firewall rules
-   Limit container privileges

### 3. Data Protection

-   Backup data volumes regularly
-   Encrypt data at rest
-   Use secure communication

## Backup & Recovery

### Data Backup

```bash
# Docker volume backup
docker run --rm -v crewly_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/crewly-data-$(date +%Y%m%d).tar.gz -C /data .

# Database backup (if using PostgreSQL)
docker exec crewly_postgres pg_dump -U crewly crewly > backup.sql
```

### Recovery

```bash
# Restore data volume
docker run --rm -v crewly_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/crewly-data-20241201.tar.gz -C /data

# Restore database
docker exec -i crewly_postgres psql -U crewly crewly < backup.sql
```

## Troubleshooting

### Common Issues

1. **Container fails to start**

    ```bash
    docker logs crewly
    # Check for port conflicts or missing environment variables
    ```

2. **High memory usage**

    ```bash
    # Check PM2 memory usage
    pm2 monit

    # Restart if needed
    pm2 restart all
    ```

3. **Database connection issues**

    ```bash
    # Check database logs
    docker logs crewly_postgres

    # Verify connection settings
    docker exec -it crewly_postgres psql -U crewly crewly
    ```

### Performance Tuning

-   **Adjust PM2 instances** based on CPU cores
-   **Configure heap size** for Node.js: `--max-old-space-size=4096`
-   **Enable clustering** for better performance
-   **Use Redis** for session storage in multi-instance deployments

## Scaling

### Horizontal Scaling

-   Deploy multiple Crewly instances behind a load balancer
-   Use shared Redis for session storage
-   Configure database clustering

### Load Balancing

```nginx
upstream crewly_backend {
    server crewly1:3000;
    server crewly2:3000;
    server crewly3:3000;
}

server {
    location / {
        proxy_pass http://crewly_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Support

For deployment issues:

1. Check the health endpoints
2. Review application logs
3. Verify environment configuration
4. Consult the troubleshooting section

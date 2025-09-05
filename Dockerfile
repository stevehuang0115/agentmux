# Multi-stage Docker build for AgentMux
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY mcp-server/package*.json ./mcp-server/
COPY cli/package*.json ./cli/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build all components
RUN npm run build

# Production stage
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    openssh-client \
    tmux \
    bash \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S agentmux && \
    adduser -S agentmux -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY mcp-server/package*.json ./mcp-server/
COPY cli/package*.json ./cli/

RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/mcp-server/dist ./mcp-server/dist
COPY --from=builder /app/cli/dist ./cli/dist

# Copy static files
COPY --from=builder /app/codes/public ./codes/public

# Create necessary directories and set permissions
RUN mkdir -p /app/data /app/logs /app/.agentmux && \
    chown -R agentmux:agentmux /app

# Switch to non-root user
USER agentmux

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV MCP_PORT=3001
ENV DATA_PATH=/app/data
ENV LOG_DIR=/app/logs

# Start command
CMD ["npm", "start"]
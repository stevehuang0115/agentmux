# =============================================================================
# Crewly Multi-Stage Docker Build
#
# Stage 1 (builder): Installs all dependencies, compiles TypeScript, builds
#                     the React frontend via Vite.
# Stage 2 (deps):    Clean install of production-only dependencies (including
#                     native modules like node-pty compiled for the target arch).
# Stage 3 (runtime): Minimal image with only compiled output + prod deps.
#
# Usage:
#   docker build -t crewly .
#   docker run -p 8787:8787 -e ANTHROPIC_API_KEY=sk-... crewly
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build TypeScript + Frontend
# ---------------------------------------------------------------------------
FROM node:20-slim AS builder

# Build tools required for native modules (node-pty)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first (better layer caching)
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (including devDependencies for TypeScript)
RUN npm ci

# Install frontend dependencies separately (not a workspace)
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Build backend (TypeScript), frontend (Vite), and CLI (TypeScript)
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Production Dependencies
# ---------------------------------------------------------------------------
FROM node:20-slim AS deps

# Build tools for native module compilation (node-pty)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 3: Runtime
# ---------------------------------------------------------------------------
FROM node:20-slim

# Runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production node_modules from deps stage (includes compiled node-pty)
COPY --from=deps /app/node_modules ./node_modules

# Compiled backend + CLI output
COPY --from=builder /app/dist ./dist

# Built frontend assets
COPY --from=builder /app/frontend/dist ./frontend/dist

# Runtime config (role prompts, skills, templates, constants)
COPY config ./config

# Package manifest (needed for npm start / version detection)
COPY package.json ./

# Create .crewly directory for persistence
RUN mkdir -p /home/node/.crewly && chown -R node:node /home/node/.crewly

# Run as non-root user
USER node

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8787/health || exit 1

ENV NODE_ENV=production
ENV WEB_PORT=8787

CMD ["node", "dist/cli/cli/src/index.js", "start", "--no-browser"]

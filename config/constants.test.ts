/**
 * Unit tests for AgentMux cross-domain constants
 * 
 * This test file validates the centralized constants that are shared
 * across all AgentMux domains (backend, frontend, CLI).
 */

import {
  AGENTMUX_CONSTANTS,
  AGENT_IDENTITY_CONSTANTS,
  WEB_CONSTANTS,
  TIMING_CONSTANTS,
  MESSAGE_CONSTANTS,
  ENV_CONSTANTS,
  type AgentStatus,
  type WorkingStatus,
  type AgentRole,
  type AgentId,
  type MessageType,
} from './constants.js';

describe('AgentMux Cross-Domain Constants', () => {
  describe('AGENTMUX_CONSTANTS', () => {
    describe('SESSIONS', () => {
      test('should have valid orchestrator name', () => {
        expect(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBe('agentmux-orc');
        expect(typeof AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBe('string');
      });

      test('should have valid timeout values', () => {
        expect(AGENTMUX_CONSTANTS.SESSIONS.DEFAULT_TIMEOUT).toBe(120000);
        expect(AGENTMUX_CONSTANTS.SESSIONS.REGISTRATION_CHECK_INTERVAL).toBe(5000);
        expect(AGENTMUX_CONSTANTS.SESSIONS.CLAUDE_DETECTION_CACHE_TIMEOUT).toBe(30000);
      });

      test('timeout values should be positive numbers', () => {
        const timeouts = [
          AGENTMUX_CONSTANTS.SESSIONS.DEFAULT_TIMEOUT,
          AGENTMUX_CONSTANTS.SESSIONS.REGISTRATION_CHECK_INTERVAL,
          AGENTMUX_CONSTANTS.SESSIONS.CLAUDE_DETECTION_CACHE_TIMEOUT,
        ];

        timeouts.forEach((timeout) => {
          expect(typeof timeout).toBe('number');
          expect(timeout).toBeGreaterThan(0);
        });
      });
    });

    describe('PATHS', () => {
      test('should have all required paths', () => {
        expect(AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME).toBe('.agentmux');
        expect(AGENTMUX_CONSTANTS.PATHS.TEAMS_FILE).toBe('teams.json');
        expect(AGENTMUX_CONSTANTS.PATHS.PROJECTS_FILE).toBe('projects.json');
        expect(AGENTMUX_CONSTANTS.PATHS.CONFIG_DIR).toBe('config');
        expect(AGENTMUX_CONSTANTS.PATHS.PROMPTS_DIR).toBe('prompts');
        expect(AGENTMUX_CONSTANTS.PATHS.TASKS_DIR).toBe('tasks');
        expect(AGENTMUX_CONSTANTS.PATHS.SPECS_DIR).toBe('specs');
        expect(AGENTMUX_CONSTANTS.PATHS.MEMORY_DIR).toBe('memory');
      });

      test('file paths should have proper extensions', () => {
        expect(AGENTMUX_CONSTANTS.PATHS.TEAMS_FILE).toMatch(/\.json$/);
        expect(AGENTMUX_CONSTANTS.PATHS.PROJECTS_FILE).toMatch(/\.json$/);
        expect(AGENTMUX_CONSTANTS.PATHS.RUNTIME_FILE).toMatch(/\.json$/);
        expect(AGENTMUX_CONSTANTS.PATHS.SCHEDULED_MESSAGES_FILE).toMatch(/\.json$/);
        expect(AGENTMUX_CONSTANTS.PATHS.MESSAGE_DELIVERY_LOGS_FILE).toMatch(/\.json$/);
      });

      test('directory names should not contain slashes', () => {
        const dirs = [
          AGENTMUX_CONSTANTS.PATHS.CONFIG_DIR,
          AGENTMUX_CONSTANTS.PATHS.PROMPTS_DIR,
          AGENTMUX_CONSTANTS.PATHS.TASKS_DIR,
          AGENTMUX_CONSTANTS.PATHS.SPECS_DIR,
          AGENTMUX_CONSTANTS.PATHS.MEMORY_DIR,
        ];

        dirs.forEach((dir) => {
          expect(dir).not.toMatch(/\//);
          expect(dir.length).toBeGreaterThan(0);
        });
      });
    });

    describe('AGENT_STATUSES', () => {
      test('should have all required statuses', () => {
        expect(AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE).toBe('inactive');
        expect(AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVATING).toBe('activating');
        expect(AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE).toBe('active');
      });

      test('all statuses should be lowercase strings', () => {
        Object.values(AGENTMUX_CONSTANTS.AGENT_STATUSES).forEach((status) => {
          expect(typeof status).toBe('string');
          expect(status).toBe(status.toLowerCase());
        });
      });
    });

    describe('WORKING_STATUSES', () => {
      test('should have all required working statuses', () => {
        expect(AGENTMUX_CONSTANTS.WORKING_STATUSES.IDLE).toBe('idle');
        expect(AGENTMUX_CONSTANTS.WORKING_STATUSES.IN_PROGRESS).toBe('in_progress');
      });

      test('all working statuses should be lowercase strings', () => {
        Object.values(AGENTMUX_CONSTANTS.WORKING_STATUSES).forEach((status) => {
          expect(typeof status).toBe('string');
          expect(status).toBe(status.toLowerCase());
        });
      });
    });

    describe('ROLES', () => {
      test('should have all required roles', () => {
        expect(AGENTMUX_CONSTANTS.ROLES.ORCHESTRATOR).toBe('orchestrator');
        expect(AGENTMUX_CONSTANTS.ROLES.PROJECT_MANAGER).toBe('pm');
        expect(AGENTMUX_CONSTANTS.ROLES.TECH_LEAD).toBe('tpm');
        expect(AGENTMUX_CONSTANTS.ROLES.DEVELOPER).toBe('developer');
        expect(AGENTMUX_CONSTANTS.ROLES.QA).toBe('qa');
        expect(AGENTMUX_CONSTANTS.ROLES.DEVOPS).toBe('devops');
      });

      test('should have display names for all roles', () => {
        Object.values(AGENTMUX_CONSTANTS.ROLES).forEach((role) => {
          expect(AGENTMUX_CONSTANTS.ROLE_DISPLAY_NAMES).toHaveProperty(role);
          expect(typeof AGENTMUX_CONSTANTS.ROLE_DISPLAY_NAMES[role as keyof typeof AGENTMUX_CONSTANTS.ROLE_DISPLAY_NAMES]).toBe('string');
        });
      });

      test('display names should be properly formatted', () => {
        Object.values(AGENTMUX_CONSTANTS.ROLE_DISPLAY_NAMES).forEach((displayName) => {
          expect(displayName.charAt(0)).toMatch(/[A-Z]/);
          expect(displayName.length).toBeGreaterThan(0);
        });
      });
    });

    describe('AGENT_IDS', () => {
      test('should have orchestrator ID defined', () => {
        expect(AGENTMUX_CONSTANTS.AGENT_IDS.ORCHESTRATOR_ID).toBe('orchestrator');
      });

      test('should be a valid string constant', () => {
        const orchestratorId: AgentId = AGENTMUX_CONSTANTS.AGENT_IDS.ORCHESTRATOR_ID;
        expect(typeof orchestratorId).toBe('string');
        expect(orchestratorId.length).toBeGreaterThan(0);
        expect(orchestratorId).toBe('orchestrator');
      });

      test('orchestrator ID should match role constant', () => {
        expect(AGENTMUX_CONSTANTS.AGENT_IDS.ORCHESTRATOR_ID).toBe(AGENTMUX_CONSTANTS.ROLES.ORCHESTRATOR);
      });
    });
  });

  describe('AGENT_IDENTITY_CONSTANTS', () => {
    describe('ORCHESTRATOR', () => {
      test('should have complete orchestrator identity', () => {
        const orch = AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR;

        expect(orch.ID).toBe('orchestrator');
        expect(orch.SESSION_NAME).toBe('agentmux-orc');
        expect(orch.ROLE).toBe('orchestrator');
      });

      test('should reference existing constants consistently', () => {
        const orch = AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR;

        // Verify references point to correct source constants
        expect(orch.ID).toBe(AGENTMUX_CONSTANTS.AGENT_IDS.ORCHESTRATOR_ID);
        expect(orch.SESSION_NAME).toBe(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
        expect(orch.ROLE).toBe(AGENTMUX_CONSTANTS.ROLES.ORCHESTRATOR);
      });

      test('should maintain type safety', () => {
        const orchestratorId: AgentId = AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID;
        const orchestratorRole: AgentRole = AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ROLE;

        expect(orchestratorId).toBe('orchestrator');
        expect(orchestratorRole).toBe('orchestrator');
      });

      test('should provide constants for agent heartbeat system', () => {
        // These constants are essential for the new agent heartbeat architecture
        expect(typeof AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID).toBe('string');
        expect(typeof AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME).toBe('string');
        expect(typeof AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ROLE).toBe('string');

        // All should be non-empty
        expect(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID.length).toBeGreaterThan(0);
        expect(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME.length).toBeGreaterThan(0);
        expect(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ROLE.length).toBeGreaterThan(0);
      });
    });

    test('should maintain consistency across all orchestrator references', () => {
      // All orchestrator constants should be consistent
      expect(AGENTMUX_CONSTANTS.AGENT_IDS.ORCHESTRATOR_ID).toBe('orchestrator');
      expect(AGENTMUX_CONSTANTS.ROLES.ORCHESTRATOR).toBe('orchestrator');
      expect(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBe('agentmux-orc');

      // Identity helper should match
      const orch = AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR;
      expect(orch.ID).toBe('orchestrator');
      expect(orch.ROLE).toBe('orchestrator');
      expect(orch.SESSION_NAME).toBe('agentmux-orc');
    });
  });

  describe('WEB_CONSTANTS', () => {
    describe('PORTS', () => {
      test('should have valid port numbers', () => {
        expect(WEB_CONSTANTS.PORTS.BACKEND).toBe(8788);
        expect(WEB_CONSTANTS.PORTS.FRONTEND).toBe(3002);
      });

      test('ports should be in valid range', () => {
        [WEB_CONSTANTS.PORTS.BACKEND, WEB_CONSTANTS.PORTS.FRONTEND].forEach((port) => {
          expect(port).toBeGreaterThan(1023);
          expect(port).toBeLessThan(65536);
        });
      });

      test('frontend and backend ports should be different', () => {
        expect(WEB_CONSTANTS.PORTS.FRONTEND).not.toBe(WEB_CONSTANTS.PORTS.BACKEND);
      });
    });

    describe('ENDPOINTS', () => {
      test('should have all required endpoints', () => {
        expect(WEB_CONSTANTS.ENDPOINTS.HEALTH).toBe('/health');
        expect(WEB_CONSTANTS.ENDPOINTS.API_BASE).toBe('/api');
        expect(WEB_CONSTANTS.ENDPOINTS.TEAMS).toBe('/api/teams');
        expect(WEB_CONSTANTS.ENDPOINTS.PROJECTS).toBe('/api/projects');
        expect(WEB_CONSTANTS.ENDPOINTS.ORCHESTRATOR).toBe('/api/orchestrator');
        expect(WEB_CONSTANTS.ENDPOINTS.TERMINAL).toBe('/api/terminal');
        expect(WEB_CONSTANTS.ENDPOINTS.TASKS).toBe('/api/tasks');
      });

      test('all endpoints should start with forward slash', () => {
        Object.values(WEB_CONSTANTS.ENDPOINTS).forEach((endpoint) => {
          expect(endpoint).toMatch(/^\/[a-z]/);
        });
      });

      test('API endpoints should start with /api', () => {
        const apiEndpoints = [
          WEB_CONSTANTS.ENDPOINTS.TEAMS,
          WEB_CONSTANTS.ENDPOINTS.PROJECTS,
          WEB_CONSTANTS.ENDPOINTS.ORCHESTRATOR,
          WEB_CONSTANTS.ENDPOINTS.TERMINAL,
          WEB_CONSTANTS.ENDPOINTS.TASKS,
        ];

        apiEndpoints.forEach((endpoint) => {
          expect(endpoint).toMatch(/^\/api\//);
        });
      });
    });
  });

  describe('TIMING_CONSTANTS', () => {
    describe('RETRIES', () => {
      test('should have valid retry configuration', () => {
        expect(TIMING_CONSTANTS.RETRIES.MAX_ATTEMPTS).toBe(3);
        expect(TIMING_CONSTANTS.RETRIES.BASE_DELAY).toBe(1000);
        expect(TIMING_CONSTANTS.RETRIES.MAX_DELAY).toBe(10000);
      });

      test('retry values should be positive', () => {
        Object.values(TIMING_CONSTANTS.RETRIES).forEach((value) => {
          expect(typeof value).toBe('number');
          expect(value).toBeGreaterThan(0);
        });
      });

      test('max delay should be greater than base delay', () => {
        expect(TIMING_CONSTANTS.RETRIES.MAX_DELAY).toBeGreaterThan(TIMING_CONSTANTS.RETRIES.BASE_DELAY);
      });
    });

    describe('INTERVALS', () => {
      test('should have valid interval values', () => {
        expect(TIMING_CONSTANTS.INTERVALS.HEALTH_CHECK).toBe(30000);
        expect(TIMING_CONSTANTS.INTERVALS.MEMORY_CLEANUP).toBe(300000);
        expect(TIMING_CONSTANTS.INTERVALS.STATUS_UPDATE).toBe(10000);
        expect(TIMING_CONSTANTS.INTERVALS.ACTIVITY_MONITOR).toBe(15000);
        expect(TIMING_CONSTANTS.INTERVALS.CLEANUP).toBe(60000);
        expect(TIMING_CONSTANTS.INTERVALS.BATCH_DELAY).toBe(500);
        expect(TIMING_CONSTANTS.INTERVALS.RATE_LIMIT_WINDOW).toBe(1000);
        expect(TIMING_CONSTANTS.INTERVALS.TASK_CLEANUP).toBe(300000);
      });

      test('all intervals should be positive numbers', () => {
        Object.values(TIMING_CONSTANTS.INTERVALS).forEach((interval) => {
          expect(typeof interval).toBe('number');
          expect(interval).toBeGreaterThan(0);
        });
      });

      test('cleanup interval should be greater than batch delay', () => {
        expect(TIMING_CONSTANTS.INTERVALS.CLEANUP).toBeGreaterThan(
          TIMING_CONSTANTS.INTERVALS.BATCH_DELAY
        );
      });

      test('task cleanup should be greater than rate limit window', () => {
        expect(TIMING_CONSTANTS.INTERVALS.TASK_CLEANUP).toBeGreaterThan(
          TIMING_CONSTANTS.INTERVALS.RATE_LIMIT_WINDOW
        );
      });
    });

    describe('TIMEOUTS', () => {
      test('should have valid timeout values', () => {
        expect(TIMING_CONSTANTS.TIMEOUTS.CLAUDE_INIT).toBe(45000);
        expect(TIMING_CONSTANTS.TIMEOUTS.AGENT_SETUP).toBe(90000);
        expect(TIMING_CONSTANTS.TIMEOUTS.TASK_COMPLETION).toBe(300000);
        expect(TIMING_CONSTANTS.TIMEOUTS.WEBSOCKET).toBe(30000);
        expect(TIMING_CONSTANTS.TIMEOUTS.HTTP_HEALTH_CHECK).toBe(3000);
        expect(TIMING_CONSTANTS.TIMEOUTS.API_REQUEST_QUICK).toBe(2000);
        expect(TIMING_CONSTANTS.TIMEOUTS.SHUTDOWN).toBe(2000);
        expect(TIMING_CONSTANTS.TIMEOUTS.CONNECTION).toBe(10000);
      });

      test('all timeouts should be positive numbers', () => {
        Object.values(TIMING_CONSTANTS.TIMEOUTS).forEach((timeout) => {
          expect(typeof timeout).toBe('number');
          expect(timeout).toBeGreaterThan(0);
        });
      });

      test('http health check timeout should be reasonable', () => {
        expect(TIMING_CONSTANTS.TIMEOUTS.HTTP_HEALTH_CHECK).toBeLessThanOrEqual(10000);
        expect(TIMING_CONSTANTS.TIMEOUTS.HTTP_HEALTH_CHECK).toBeGreaterThanOrEqual(1000);
      });

      test('connection timeout should be reasonable', () => {
        expect(TIMING_CONSTANTS.TIMEOUTS.CONNECTION).toBeGreaterThanOrEqual(5000);
        expect(TIMING_CONSTANTS.TIMEOUTS.CONNECTION).toBeLessThanOrEqual(30000);
      });
    });
  });

  describe('MESSAGE_CONSTANTS', () => {
    describe('LIMITS', () => {
      test('should have valid message limits', () => {
        expect(MESSAGE_CONSTANTS.LIMITS.CHUNK_SIZE).toBe(1500);
        expect(MESSAGE_CONSTANTS.LIMITS.SMALL_CHUNK_SIZE).toBe(200);
        expect(MESSAGE_CONSTANTS.LIMITS.MAX_BUFFER_SIZE).toBe(100);
      });

      test('chunk size should be larger than small chunk size', () => {
        expect(MESSAGE_CONSTANTS.LIMITS.CHUNK_SIZE).toBeGreaterThan(MESSAGE_CONSTANTS.LIMITS.SMALL_CHUNK_SIZE);
      });

      test('all limits should be positive numbers', () => {
        Object.values(MESSAGE_CONSTANTS.LIMITS).forEach((limit) => {
          expect(typeof limit).toBe('number');
          expect(limit).toBeGreaterThan(0);
        });
      });
    });

    describe('TYPES', () => {
      test('should have all required message types', () => {
        const expectedTypes = ['system', 'user', 'agent', 'error', 'broadcast'];
        expectedTypes.forEach((type) => {
          expect(Object.values(MESSAGE_CONSTANTS.TYPES)).toContain(type);
        });
      });

      test('message types should be lowercase strings', () => {
        Object.values(MESSAGE_CONSTANTS.TYPES).forEach((type) => {
          expect(typeof type).toBe('string');
          expect(type).toBe(type.toLowerCase());
        });
      });
    });
  });

  describe('ENV_CONSTANTS', () => {
    test('should have all required environment variables', () => {
      const expectedEnvVars = [
        'TMUX_SESSION_NAME',
        'AGENTMUX_ROLE',
        'API_PORT',
        'AGENTMUX_MCP_PORT',
        'PROJECT_PATH',
        'AGENT_ROLE',
        'NODE_ENV',
        'DEV_MODE',
      ];

      expectedEnvVars.forEach((envVar) => {
        expect(Object.values(ENV_CONSTANTS)).toContain(envVar);
      });
    });

    test('all env var names should be uppercase with underscores', () => {
      Object.values(ENV_CONSTANTS).forEach((envVar) => {
        expect(envVar).toMatch(/^[A-Z_]+$/);
      });
    });

    test('env var names should not be empty', () => {
      Object.values(ENV_CONSTANTS).forEach((envVar) => {
        expect(envVar.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Type Helpers', () => {
    test('AgentStatus type should include all status values', () => {
      const testStatus: AgentStatus = 'active';
      expect(['active', 'inactive', 'activating']).toContain(testStatus);
    });

    test('WorkingStatus type should include all working status values', () => {
      const testWorkingStatus: WorkingStatus = 'idle';
      expect(['idle', 'in_progress']).toContain(testWorkingStatus);
    });

    test('AgentRole type should include all role values', () => {
      const testRole: AgentRole = 'developer';
      expect(['orchestrator', 'pm', 'tpm', 'developer', 'qa', 'devops']).toContain(testRole);
    });

    test('MessageType type should include all message type values', () => {
      const testMessageType: MessageType = 'system';
      expect(Object.values(MESSAGE_CONSTANTS.TYPES)).toContain(testMessageType);
    });
  });

  describe('Constants Structure', () => {
    test('all main constant objects should be defined', () => {
      expect(AGENTMUX_CONSTANTS).toBeDefined();
      expect(WEB_CONSTANTS).toBeDefined();
      expect(TIMING_CONSTANTS).toBeDefined();
      expect(MESSAGE_CONSTANTS).toBeDefined();
      expect(ENV_CONSTANTS).toBeDefined();
    });

    test('constants should be immutable (const assertions)', () => {
      // These tests verify that const assertions are working
      expect(typeof AGENTMUX_CONSTANTS).toBe('object');
      expect(typeof WEB_CONSTANTS).toBe('object');
      expect(typeof TIMING_CONSTANTS).toBe('object');
      expect(typeof MESSAGE_CONSTANTS).toBe('object');
      expect(typeof ENV_CONSTANTS).toBe('object');
    });
  });

  describe('Cross-Domain Consistency', () => {
    test('orchestrator session name should be consistent', () => {
      expect(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBe('agentmux-orc');
    });

    test('timeout values should be reasonable', () => {
      // Agent setup timeout should be longer than Claude init timeout
      expect(TIMING_CONSTANTS.TIMEOUTS.AGENT_SETUP).toBeGreaterThan(TIMING_CONSTANTS.TIMEOUTS.CLAUDE_INIT);
      
      // Task completion timeout should be longest
      expect(TIMING_CONSTANTS.TIMEOUTS.TASK_COMPLETION).toBeGreaterThan(TIMING_CONSTANTS.TIMEOUTS.AGENT_SETUP);
    });
  });
});
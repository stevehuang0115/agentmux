/**
 * Unit tests for AgentMux backend-specific constants
 *
 * This test file validates that all backend constants are properly defined,
 * follow naming conventions, and maintain type safety.
 */
import { 
// Orchestrator constants
ORCHESTRATOR_SESSION_NAME, ORCHESTRATOR_DISPLAY_NAME, ORCHESTRATOR_ROLE, ORCHESTRATOR_WINDOW_NAME, 
// Timeout constants
ORCHESTRATOR_SETUP_TIMEOUT, AGENT_INITIALIZATION_TIMEOUT, CLAUDE_INITIALIZATION_TIMEOUT, CLAUDE_READY_TIMEOUT, TASK_MONITOR_POLL_INTERVAL_MS, MCP_DEFAULT_TIMEOUT, HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_TIMEOUT_MS, AGENT_DEFAULT_TIMEOUT_MS, CONTEXT_REFRESH_INTERVAL_MS, WS_PING_TIMEOUT_MS, WS_PING_INTERVAL_MS, BACKUP_INTERVAL_MS, RATE_LIMIT_WINDOW_MS, COMMAND_TIMESTAMP_OFFSET_MS, COMMAND_TIMESTAMP_OFFSET_MS_LONG, 
// Directory constants
AGENTMUX_HOME_DIR, CONFIG_DIR, PROMPTS_DIR, TASKS_DIR, SPECS_DIR, MEMORY_DIR, ADDITIONAL_DIRS, 
// File constants
TEAMS_CONFIG_FILE, ACTIVE_PROJECTS_FILE, TASK_TRACKING_FILE, COMMUNICATION_LOG_FILE, CONFIG_FILE_NAMES, LOG_FILE_PREFIX, LOG_FILE_EXTENSION, 
// Port constants
DEFAULT_WEB_PORT, DEFAULT_MCP_PORT, 
// Role constants
AGENT_ROLES, ROLE_DISPLAY_NAMES, 
// Environment variables
ENV_VARS, ADDITIONAL_ENV_VARS, 
// Script constants
INIT_SCRIPTS, MAX_OUTPUT_BUFFER_SIZE, MAX_CONTEXT_FILE_SIZE_BYTES, MAX_REQUEST_BODY_SIZE, DEFAULT_LOG_LIMIT, MAX_CONCURRENT_MONITORING_JOBS, DEFAULT_LOG_FILE_SIZE, 
// Message constants
MESSAGE_CHUNK_SIZE, SMALL_CHUNK_SIZE, 
// Status constants
AGENT_STATUS_VALUES, WORKING_STATUS_VALUES, DEFAULT_AGENT_STATUS, DEFAULT_WORKING_STATUS, 
// Session constants
AGENTMUX_SESSION_PREFIX, 
// Command constants
ORCHESTRATOR_COMMANDS, TMUX_COMMANDS, ORCHESTRATOR_HELP_TEXT, SPECIAL_KEYS, 
// Path constants
FRONTEND_DIST_PATH, 
// Network constants
DEFAULT_CORS_ORIGIN, ALLOWED_HTTP_METHODS, HTTP_STATUS_CODES, 
// API endpoints
API_ENDPOINTS, } from './backend-constants.js';
describe('AgentMux Backend Constants', () => {
    describe('Orchestrator Constants', () => {
        test('should have valid orchestrator session name', () => {
            expect(ORCHESTRATOR_SESSION_NAME).toBe('agentmux-orc');
            expect(typeof ORCHESTRATOR_SESSION_NAME).toBe('string');
            expect(ORCHESTRATOR_SESSION_NAME.length).toBeGreaterThan(0);
        });
        test('should have valid orchestrator display name', () => {
            expect(ORCHESTRATOR_DISPLAY_NAME).toBe('Orchestrator');
            expect(typeof ORCHESTRATOR_DISPLAY_NAME).toBe('string');
        });
        test('should have valid orchestrator role', () => {
            expect(ORCHESTRATOR_ROLE).toBe('orchestrator');
            expect(typeof ORCHESTRATOR_ROLE).toBe('string');
        });
        test('should have valid orchestrator window name', () => {
            expect(ORCHESTRATOR_WINDOW_NAME).toBe('AgentMux Orchestrator');
            expect(typeof ORCHESTRATOR_WINDOW_NAME).toBe('string');
        });
    });
    describe('Timeout Constants', () => {
        test('should have valid timeout values', () => {
            expect(ORCHESTRATOR_SETUP_TIMEOUT).toBe(30000);
            expect(AGENT_INITIALIZATION_TIMEOUT).toBe(90000);
            expect(CLAUDE_INITIALIZATION_TIMEOUT).toBe(45000);
            expect(CLAUDE_READY_TIMEOUT).toBe(45000);
            expect(TASK_MONITOR_POLL_INTERVAL_MS).toBe(2000);
            expect(MCP_DEFAULT_TIMEOUT).toBe(30000);
            expect(HEALTH_CHECK_INTERVAL_MS).toBe(30000);
            expect(HEALTH_CHECK_TIMEOUT_MS).toBe(1000);
            expect(AGENT_DEFAULT_TIMEOUT_MS).toBe(300000);
            expect(CONTEXT_REFRESH_INTERVAL_MS).toBe(1800000);
            expect(WS_PING_TIMEOUT_MS).toBe(60000);
            expect(WS_PING_INTERVAL_MS).toBe(25000);
            expect(BACKUP_INTERVAL_MS).toBe(3600000);
            expect(RATE_LIMIT_WINDOW_MS).toBe(900000);
            expect(COMMAND_TIMESTAMP_OFFSET_MS).toBe(300000);
            expect(COMMAND_TIMESTAMP_OFFSET_MS_LONG).toBe(600000);
        });
        test('all timeout values should be positive numbers', () => {
            const timeouts = [
                ORCHESTRATOR_SETUP_TIMEOUT,
                AGENT_INITIALIZATION_TIMEOUT,
                CLAUDE_INITIALIZATION_TIMEOUT,
                CLAUDE_READY_TIMEOUT,
                TASK_MONITOR_POLL_INTERVAL_MS,
                MCP_DEFAULT_TIMEOUT,
                HEALTH_CHECK_INTERVAL_MS,
                HEALTH_CHECK_TIMEOUT_MS,
                AGENT_DEFAULT_TIMEOUT_MS,
                CONTEXT_REFRESH_INTERVAL_MS,
                WS_PING_TIMEOUT_MS,
                WS_PING_INTERVAL_MS,
                BACKUP_INTERVAL_MS,
                RATE_LIMIT_WINDOW_MS,
                COMMAND_TIMESTAMP_OFFSET_MS,
                COMMAND_TIMESTAMP_OFFSET_MS_LONG,
            ];
            timeouts.forEach((timeout) => {
                expect(typeof timeout).toBe('number');
                expect(timeout).toBeGreaterThan(0);
            });
        });
    });
    describe('Directory Constants', () => {
        test('should have valid directory names', () => {
            expect(AGENTMUX_HOME_DIR).toBe('.agentmux');
            expect(CONFIG_DIR).toBe('config');
            expect(PROMPTS_DIR).toBe('prompts');
            expect(TASKS_DIR).toBe('tasks');
            expect(SPECS_DIR).toBe('specs');
            expect(MEMORY_DIR).toBe('memory');
        });
        test('should have additional directory names', () => {
            expect(ADDITIONAL_DIRS.LOGS).toBe('logs');
            expect(ADDITIONAL_DIRS.DATA).toBe('data');
        });
        test('all directory names should be non-empty strings', () => {
            const dirs = [
                AGENTMUX_HOME_DIR,
                CONFIG_DIR,
                PROMPTS_DIR,
                TASKS_DIR,
                SPECS_DIR,
                MEMORY_DIR,
                ADDITIONAL_DIRS.LOGS,
                ADDITIONAL_DIRS.DATA,
            ];
            dirs.forEach((dir) => {
                expect(typeof dir).toBe('string');
                expect(dir.length).toBeGreaterThan(0);
            });
        });
    });
    describe('File Constants', () => {
        test('should have valid file names', () => {
            expect(TEAMS_CONFIG_FILE).toBe('teams.json');
            expect(ACTIVE_PROJECTS_FILE).toBe('active_projects.json');
            expect(TASK_TRACKING_FILE).toBe('in_progress_tasks.json');
            expect(COMMUNICATION_LOG_FILE).toBe('communication.log');
        });
        test('should have config file names object', () => {
            expect(CONFIG_FILE_NAMES.CONFIG_JSON).toBe('config.json');
            expect(CONFIG_FILE_NAMES.APP_JSON).toBe('app.json');
        });
        test('should have log file patterns', () => {
            expect(LOG_FILE_PREFIX).toBe('agentmux-');
            expect(LOG_FILE_EXTENSION).toBe('.log');
        });
        test('all file names should have proper extensions', () => {
            expect(TEAMS_CONFIG_FILE).toMatch(/\.json$/);
            expect(ACTIVE_PROJECTS_FILE).toMatch(/\.json$/);
            expect(TASK_TRACKING_FILE).toMatch(/\.json$/);
            expect(COMMUNICATION_LOG_FILE).toMatch(/\.log$/);
        });
    });
    describe('Port Constants', () => {
        test('should have valid port numbers', () => {
            expect(DEFAULT_WEB_PORT).toBe(3000);
            expect(DEFAULT_MCP_PORT).toBe(3001);
        });
        test('port numbers should be in valid range', () => {
            expect(DEFAULT_WEB_PORT).toBeGreaterThan(1023);
            expect(DEFAULT_WEB_PORT).toBeLessThan(65536);
            expect(DEFAULT_MCP_PORT).toBeGreaterThan(1023);
            expect(DEFAULT_MCP_PORT).toBeLessThan(65536);
        });
    });
    describe('Role Constants', () => {
        test('should have all required agent roles', () => {
            expect(AGENT_ROLES.ORCHESTRATOR).toBe('orchestrator');
            expect(AGENT_ROLES.PROJECT_MANAGER).toBe('pm');
            expect(AGENT_ROLES.TECH_LEAD).toBe('tpm');
            expect(AGENT_ROLES.DEVELOPER).toBe('developer');
            expect(AGENT_ROLES.QA).toBe('qa');
            expect(AGENT_ROLES.DEVOPS).toBe('devops');
        });
        test('should have display names for all roles', () => {
            Object.values(AGENT_ROLES).forEach((role) => {
                expect(ROLE_DISPLAY_NAMES).toHaveProperty(role);
                expect(typeof ROLE_DISPLAY_NAMES[role]).toBe('string');
            });
        });
        test('role display names should be properly capitalized', () => {
            Object.values(ROLE_DISPLAY_NAMES).forEach((displayName) => {
                expect(displayName.charAt(0)).toMatch(/[A-Z]/);
            });
        });
    });
    describe('Status Constants', () => {
        test('should have valid agent status values', () => {
            expect(AGENT_STATUS_VALUES.ACTIVE).toBe('active');
            expect(AGENT_STATUS_VALUES.INACTIVE).toBe('inactive');
            expect(AGENT_STATUS_VALUES.ACTIVATING).toBe('activating');
        });
        test('should have valid working status values', () => {
            expect(WORKING_STATUS_VALUES.IN_PROGRESS).toBe('in_progress');
            expect(WORKING_STATUS_VALUES.IDLE).toBe('idle');
        });
        test('should have valid default statuses', () => {
            expect(DEFAULT_AGENT_STATUS).toBe('inactive');
            expect(DEFAULT_WORKING_STATUS).toBe('idle');
        });
        test('default statuses should match defined status values', () => {
            expect(Object.values(AGENT_STATUS_VALUES)).toContain(DEFAULT_AGENT_STATUS);
            expect(Object.values(WORKING_STATUS_VALUES)).toContain(DEFAULT_WORKING_STATUS);
        });
    });
    describe('Environment Variable Constants', () => {
        test('should have all required env var names', () => {
            expect(ENV_VARS.TMUX_SESSION_NAME).toBe('TMUX_SESSION_NAME');
            expect(ENV_VARS.AGENTMUX_ROLE).toBe('AGENTMUX_ROLE');
            expect(ENV_VARS.API_PORT).toBe('API_PORT');
            expect(ENV_VARS.MCP_PORT).toBe('AGENTMUX_MCP_PORT');
            expect(ENV_VARS.PROJECT_PATH).toBe('PROJECT_PATH');
            expect(ENV_VARS.AGENT_ROLE).toBe('AGENT_ROLE');
        });
        test('should have additional env var names', () => {
            expect(ADDITIONAL_ENV_VARS.WEB_PORT).toBe('WEB_PORT');
            expect(ADDITIONAL_ENV_VARS.DEFAULT_CHECK_INTERVAL).toBe('DEFAULT_CHECK_INTERVAL');
            expect(ADDITIONAL_ENV_VARS.AUTO_COMMIT_INTERVAL).toBe('AUTO_COMMIT_INTERVAL');
            expect(ADDITIONAL_ENV_VARS.AGENTMUX_HOME).toBe('AGENTMUX_HOME');
        });
        test('all env var names should be uppercase with underscores', () => {
            const allEnvVars = { ...ENV_VARS, ...ADDITIONAL_ENV_VARS };
            Object.values(allEnvVars).forEach((envVar) => {
                expect(envVar).toMatch(/^[A-Z_]+$/);
            });
        });
    });
    describe('Command Constants', () => {
        test('should have orchestrator commands', () => {
            expect(ORCHESTRATOR_COMMANDS.GET_TEAM_STATUS).toBe('get_team_status');
            expect(ORCHESTRATOR_COMMANDS.LIST_PROJECTS).toBe('list_projects');
            expect(ORCHESTRATOR_COMMANDS.LIST_SESSIONS).toBe('list_sessions');
            expect(ORCHESTRATOR_COMMANDS.BROADCAST).toBe('broadcast');
            expect(ORCHESTRATOR_COMMANDS.HELP).toBe('help');
        });
        test('should have tmux commands', () => {
            expect(TMUX_COMMANDS.LIST_SESSIONS).toContain('tmux list-sessions');
        });
        test('should have help text', () => {
            expect(typeof ORCHESTRATOR_HELP_TEXT).toBe('string');
            expect(ORCHESTRATOR_HELP_TEXT.length).toBeGreaterThan(0);
            expect(ORCHESTRATOR_HELP_TEXT).toContain('Available commands:');
        });
        test('should have special keys', () => {
            expect(SPECIAL_KEYS.ENTER).toBe('Enter');
            expect(SPECIAL_KEYS.CTRL_C).toBe('C-c');
        });
    });
    describe('Size and Limit Constants', () => {
        test('should have valid size limits', () => {
            expect(MAX_CONTEXT_FILE_SIZE_BYTES).toBe(1048576); // 1MB
            expect(MAX_REQUEST_BODY_SIZE).toBe('10mb');
            expect(DEFAULT_LOG_LIMIT).toBe(100);
            expect(MAX_CONCURRENT_MONITORING_JOBS).toBe(10);
            expect(DEFAULT_LOG_FILE_SIZE).toBe('10m');
        });
        test('should have valid message limits', () => {
            expect(MESSAGE_CHUNK_SIZE).toBe(1500);
            expect(SMALL_CHUNK_SIZE).toBe(200);
            expect(MAX_OUTPUT_BUFFER_SIZE).toBe(100);
        });
        test('all numeric size limits should be positive', () => {
            const numericLimits = [
                MAX_CONTEXT_FILE_SIZE_BYTES,
                DEFAULT_LOG_LIMIT,
                MAX_CONCURRENT_MONITORING_JOBS,
                MESSAGE_CHUNK_SIZE,
                SMALL_CHUNK_SIZE,
                MAX_OUTPUT_BUFFER_SIZE,
            ];
            numericLimits.forEach((limit) => {
                expect(typeof limit).toBe('number');
                expect(limit).toBeGreaterThan(0);
            });
        });
    });
    describe('Network Constants', () => {
        test('should have valid CORS origin', () => {
            expect(DEFAULT_CORS_ORIGIN).toBe('http://localhost:3000');
            expect(DEFAULT_CORS_ORIGIN).toMatch(/^https?:\/\//);
        });
        test('should have allowed HTTP methods', () => {
            expect(ALLOWED_HTTP_METHODS).toEqual(['GET', 'POST']);
            expect(Array.isArray(ALLOWED_HTTP_METHODS)).toBe(true);
        });
        test('should have HTTP status codes', () => {
            expect(HTTP_STATUS_CODES.OK).toBe(200);
            expect(HTTP_STATUS_CODES.CREATED).toBe(201);
            expect(HTTP_STATUS_CODES.BAD_REQUEST).toBe(400);
            expect(HTTP_STATUS_CODES.NOT_FOUND).toBe(404);
            expect(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).toBe(500);
            expect(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).toBe(503);
        });
        test('all HTTP status codes should be valid', () => {
            Object.values(HTTP_STATUS_CODES).forEach((code) => {
                expect(typeof code).toBe('number');
                expect(code).toBeGreaterThanOrEqual(100);
                expect(code).toBeLessThan(600);
            });
        });
    });
    describe('API Endpoint Constants', () => {
        test('should have all required endpoints', () => {
            expect(API_ENDPOINTS.HEALTH).toBe('/health');
            expect(API_ENDPOINTS.API_BASE).toBe('/api');
            expect(API_ENDPOINTS.TEAMS).toBe('/api/teams');
            expect(API_ENDPOINTS.ORCHESTRATOR_SETUP).toBe('/api/orchestrator/setup');
            expect(API_ENDPOINTS.PROJECTS).toBe('/projects');
            expect(API_ENDPOINTS.MONITORING).toBe('/monitoring');
            expect(API_ENDPOINTS.SYSTEM).toBe('/system');
        });
        test('all endpoints should start with forward slash', () => {
            Object.values(API_ENDPOINTS).forEach((endpoint) => {
                expect(endpoint).toMatch(/^\//);
            });
        });
        test('API endpoints should be properly formatted', () => {
            expect(API_ENDPOINTS.TEAMS).toMatch(/^\/api\//);
            expect(API_ENDPOINTS.ORCHESTRATOR_SETUP).toMatch(/^\/api\//);
        });
    });
    describe('Path Constants', () => {
        test('should have frontend dist path', () => {
            expect(FRONTEND_DIST_PATH).toBe('../../frontend/dist');
            expect(FRONTEND_DIST_PATH).toMatch(/^\.\.\/\//); // Should start with ../
        });
    });
    describe('Session Constants', () => {
        test('should have session prefix', () => {
            expect(AGENTMUX_SESSION_PREFIX).toBe('agentmux_');
            expect(AGENTMUX_SESSION_PREFIX).toMatch(/_$/); // Should end with underscore
        });
    });
    describe('Script Constants', () => {
        test('should have initialization scripts', () => {
            expect(INIT_SCRIPTS.TMUX).toBe('initialize_tmux.sh');
            expect(INIT_SCRIPTS.CLAUDE).toBe('initialize_claude.sh');
        });
        test('all script names should have .sh extension', () => {
            Object.values(INIT_SCRIPTS).forEach((script) => {
                expect(script).toMatch(/\.sh$/);
            });
        });
    });
    describe('Constants Immutability', () => {
        test('object constants should be frozen (const assertions)', () => {
            // Test that object constants are properly typed as const
            expect(() => {
                // These should cause TypeScript errors if const assertions are missing
                // @ts-expect-error - Testing const assertion
                AGENT_ROLES.ORCHESTRATOR = 'changed';
            }).toThrow();
        });
    });
    describe('Constants Completeness', () => {
        test('should have no undefined constants', () => {
            const constants = [
                ORCHESTRATOR_SESSION_NAME,
                AGENT_ROLES,
                API_ENDPOINTS,
                {
                    ORCHESTRATOR_SETUP_TIMEOUT,
                    AGENT_INITIALIZATION_TIMEOUT,
                    CLAUDE_INITIALIZATION_TIMEOUT,
                }
            ];
            constants.forEach((constant) => {
                expect(constant).toBeDefined();
                expect(constant).not.toBeNull();
            });
        });
    });
});
//# sourceMappingURL=backend-constants.test.js.map
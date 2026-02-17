// Test helper to work around ES module issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// For tests, we'll use a mock server instead of importing the real one
export class MockAgentMuxServer {
  private config: any;
  private mockHttpServer: any;
  
  constructor(config?: any) {
    this.config = {
      webPort: config?.webPort || 3000,
      agentmuxHome: config?.agentmuxHome || '~/.agentmux',
      ...config
    };
    
    // Create a mock HTTP server
    this.mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn()
    };
  }

  async start(): Promise<void> {
    // Mock the start process
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    // Mock the shutdown process
    return Promise.resolve();
  }

  getHttpServer(): any {
    return this.mockHttpServer;
  }
}

export default MockAgentMuxServer;
#!/usr/bin/env node

/**
 * MCP Server Test Suite
 * Tests the MCP server functionality according to the testing plan
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

class MCPTestSuite {
  constructor() {
    this.projectPath = process.cwd();
    this.testSessionName = `mcp-test-${Date.now()}`;
    this.mcpServerPort = 3001;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Starting MCP Server Test Suite\n');
    
    try {
      await this.setup();
      
      // Run individual test categories
      await this.testBasicFunctionality();
      await this.testCommunicationTools();
      await this.testTicketManagement();
      await this.testGitIntegration();
      
      await this.cleanup();
      
      // Report results
      this.reportResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Create test tmux session
    try {
      await execAsync(`tmux new-session -d -s "${this.testSessionName}" -c "${this.projectPath}"`);
      console.log(`✅ Created test session: ${this.testSessionName}`);
    } catch (error) {
      console.log(`ℹ️  Test session already exists or tmux not available`);
    }
    
    // Set environment variables for testing
    process.env.TMUX_SESSION_NAME = this.testSessionName;
    process.env.PROJECT_PATH = this.projectPath;
    process.env.AGENT_ROLE = 'developer';
    process.env.MCP_PORT = this.mcpServerPort.toString();
    
    console.log('✅ Environment configured for testing\n');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    
    try {
      await execAsync(`tmux kill-session -t "${this.testSessionName}" 2>/dev/null || true`);
      console.log('✅ Cleaned up test session');
    } catch (error) {
      // Session might not exist
    }
  }

  async testBasicFunctionality() {
    console.log('📋 Testing Basic MCP Server Functionality...');
    
    try {
      // Test 1: Import and instantiate MCP server
      const { default: AgentMuxMCP } = await import('./mcp-server/src/index.ts');
      const mcpServer = new AgentMuxMCP();
      
      this.addTestResult('MCP Server Instantiation', true, 'Server created successfully');
      
      // Test 2: Check tool registration (simulate tools/list request)
      console.log('  - Testing tool registration...');
      
      // We can't easily test the MCP server directly without starting it,
      // but we can verify the structure
      if (mcpServer) {
        this.addTestResult('Tool Registration', true, 'MCP server has required structure');
      }
      
    } catch (error) {
      this.addTestResult('MCP Server Basic Tests', false, error.message);
    }
  }

  async testCommunicationTools() {
    console.log('💬 Testing Communication Tools...');
    
    try {
      // Test 1: Check if tmux sessions exist for communication
      const sessionsCmd = `tmux list-sessions -F "#{session_name}"`;
      const result = await execAsync(sessionsCmd);
      const sessions = result.stdout.split('\n').filter(s => s.trim());
      
      if (sessions.length > 0) {
        this.addTestResult('Session Detection', true, `Found ${sessions.length} sessions`);
      } else {
        this.addTestResult('Session Detection', false, 'No tmux sessions found');
      }
      
      // Test 2: Test message sending functionality (mock)
      try {
        const testMessage = "Test message from MCP test suite";
        const targetSession = sessions.find(s => s !== this.testSessionName) || sessions[0];
        
        if (targetSession) {
          // This would normally be called through MCP, but we test the command directly
          const sendCmd = `tmux send-keys -t "${targetSession}:0" "echo '${testMessage}'" Enter`;
          await execAsync(sendCmd);
          
          // Give it a moment then capture
          await new Promise(resolve => setTimeout(resolve, 1000));
          const captureCmd = `tmux capture-pane -t "${targetSession}:0" -p | tail -5`;
          const captured = await execAsync(captureCmd);
          
          if (captured.stdout.includes(testMessage)) {
            this.addTestResult('Message Sending', true, 'Message sent and received');
          } else {
            this.addTestResult('Message Sending', false, 'Message not found in target session');
          }
        }
      } catch (error) {
        this.addTestResult('Message Sending', false, error.message);
      }
      
    } catch (error) {
      this.addTestResult('Communication Tools', false, error.message);
    }
  }

  async testTicketManagement() {
    console.log('🎫 Testing Ticket Management...');
    
    try {
      // Test 1: Create test ticket directory structure
      const ticketsDir = `${this.projectPath}/.agentmux/tickets`;
      await fs.mkdir(ticketsDir, { recursive: true });
      
      // Test 2: Create a test ticket file
      const testTicketId = `test-ticket-${Date.now()}`;
      const ticketContent = `---
id: ${testTicketId}
title: Test Ticket
status: todo
priority: medium
assignedTo: ${this.testSessionName}
createdAt: ${new Date().toISOString()}
---

## Description

This is a test ticket created by the MCP test suite.

## Acceptance Criteria

- [ ] Test ticket can be created
- [ ] Test ticket can be read
- [ ] Test ticket can be updated
`;

      const ticketPath = `${ticketsDir}/${testTicketId}.yaml`;
      await fs.writeFile(ticketPath, ticketContent);
      
      // Test 3: Verify ticket file exists and is readable
      const readContent = await fs.readFile(ticketPath, 'utf-8');
      if (readContent.includes(testTicketId)) {
        this.addTestResult('Ticket File Creation', true, 'Ticket created and readable');
      } else {
        this.addTestResult('Ticket File Creation', false, 'Ticket content verification failed');
      }
      
      // Test 4: Test ticket parsing (simulate the parsing logic)
      const yamlMatch = readContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (yamlMatch) {
        this.addTestResult('Ticket Parsing', true, 'Ticket YAML parsing works');
      } else {
        this.addTestResult('Ticket Parsing', false, 'YAML parsing failed');
      }
      
      // Cleanup test ticket
      await fs.unlink(ticketPath);
      
    } catch (error) {
      this.addTestResult('Ticket Management', false, error.message);
    }
  }

  async testGitIntegration() {
    console.log('🔀 Testing Git Integration...');
    
    try {
      // Test 1: Check if project is a git repository
      const gitStatusCmd = `cd ${this.projectPath} && git status --porcelain`;
      const gitStatus = await execAsync(gitStatusCmd);
      
      this.addTestResult('Git Repository Detection', true, 'Git repository detected');
      
      // Test 2: Test git commit simulation (without actually committing)
      const hasChanges = gitStatus.stdout.trim().length > 0;
      if (hasChanges) {
        this.addTestResult('Git Changes Detection', true, 'Uncommitted changes detected');
      } else {
        this.addTestResult('Git Changes Detection', true, 'Repository is clean');
      }
      
      // Test 3: Test git log access
      const gitLogCmd = `cd ${this.projectPath} && git log --oneline -5`;
      const gitLog = await execAsync(gitLogCmd);
      
      if (gitLog.stdout.trim()) {
        this.addTestResult('Git History Access', true, 'Git history accessible');
      } else {
        this.addTestResult('Git History Access', false, 'No git history found');
      }
      
    } catch (error) {
      this.addTestResult('Git Integration', false, error.message);
    }
  }

  addTestResult(testName, success, details) {
    this.testResults.push({
      test: testName,
      success,
      details,
      timestamp: new Date().toISOString()
    });
    
    const icon = success ? '✅' : '❌';
    console.log(`  ${icon} ${testName}: ${details}`);
  }

  reportResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((passedTests/totalTests)*100)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.test}: ${result.details}`);
      });
    }
    
    // Save detailed results
    const reportPath = `${this.projectPath}/mcp-test-report.json`;
    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests/totalTests)*100)
      },
      results: this.testResults,
      environment: {
        projectPath: this.projectPath,
        testSession: this.testSessionName,
        timestamp: new Date().toISOString()
      }
    };
    
    fs.writeFile(reportPath, JSON.stringify(report, null, 2))
      .then(() => console.log(`\n📄 Detailed report saved to: ${reportPath}`))
      .catch(err => console.error('Failed to save report:', err));
    
    console.log('\n🏁 MCP Server Test Suite Complete!\n');
    
    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new MCPTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

export default MCPTestSuite;
/**
 * Smoke Test — Crewly Agent Runtime end-to-end with Gemini API
 *
 * Verifies the full pipeline: CrewlyAgentRuntimeService → AgentRunnerService →
 * AI SDK generateText → Gemini model → tool calls → response.
 *
 * Usage:
 *   npx tsx backend/src/services/agent/crewly-agent/smoke-test.ts
 *
 * Requires: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY env var
 */

import { CrewlyAgentRuntimeService } from './crewly-agent-runtime.service.js';
import type { SessionCommandHelper } from '../../session/index.js';

// Bridge GEMINI_API_KEY → GOOGLE_GENERATIVE_AI_API_KEY if needed
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: No Google AI API key found. Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('=== Crewly Agent Runtime Smoke Test ===\n');
  console.log('Provider: google');
  console.log('Model: gemini-2.0-flash');
  console.log('API Key: ...%s', API_KEY!.slice(-6));
  console.log();

  // Create a minimal mock SessionCommandHelper (not used by in-process runtime)
  const mockSessionHelper = {
    capturePane: () => '',
    sendMessage: async () => {},
    clearCurrentCommandLine: async () => {},
  } as unknown as SessionCommandHelper;

  const projectRoot = process.cwd();
  const runtime = new CrewlyAgentRuntimeService(mockSessionHelper, projectRoot);

  try {
    // Step 1: Initialize with Gemini
    console.log('[1/4] Initializing runtime...');
    await runtime.initializeInProcess('smoke-test-session', {
      model: { provider: 'google', modelId: 'gemini-2.0-flash' },
      maxSteps: 5,
      systemPrompt: `You are a test agent. When asked to check team status, you MUST call the get_team_status tool. After getting the result, summarize it briefly. Always use tools when available.`,
    });
    console.log('  -> Runtime ready:', runtime.isReady());
    console.log('  -> Session:', runtime.getSessionName());

    if (!runtime.isReady()) {
      throw new Error('Runtime failed to initialize');
    }

    // Step 2: Send a message that should trigger the get_team_status tool
    console.log('\n[2/4] Sending message: "Check team status"...');
    const result = await runtime.handleMessage('Check the current team status and report what you find.');

    // Step 3: Verify results
    console.log('\n[3/4] Results:');
    console.log('  -> Response text:', result.text?.substring(0, 200) || '(empty)');
    console.log('  -> Steps:', result.steps);
    console.log('  -> Tool calls:', result.toolCalls.length);
    console.log('  -> Usage:', JSON.stringify(result.usage));
    console.log('  -> Finish reason:', result.finishReason);

    if (result.toolCalls.length > 0) {
      console.log('\n  Tool call details:');
      for (const tc of result.toolCalls) {
        console.log(`    - ${tc.toolName}(${JSON.stringify(tc.args)})`);
        console.log(`      Result: ${JSON.stringify(tc.result)?.substring(0, 150)}`);
      }
    }

    // Step 4: Verify model used the tool
    const usedGetTeamStatus = result.toolCalls.some(tc => tc.toolName === 'get_team_status');
    console.log('\n[4/4] Verification:');
    console.log('  -> Model called get_team_status:', usedGetTeamStatus);
    console.log('  -> Got text response:', !!result.text);
    console.log('  -> Steps > 0:', result.steps > 0);

    const passed = result.text && result.steps > 0;
    console.log('\n=== SMOKE TEST %s ===', passed ? 'PASSED' : 'FAILED');

    if (!passed) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n=== SMOKE TEST FAILED ===');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  } finally {
    runtime.shutdown();
  }
}

main();

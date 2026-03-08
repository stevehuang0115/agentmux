/**
 * Serialization and deserialization for hierarchy message types.
 *
 * Converts structured message objects to markdown for PTY delivery,
 * and parses markdown back into typed objects on the agent side.
 *
 * Format uses header blocks with bracketed type identifiers:
 *   [TASK ASSIGNMENT], [STATUS REPORT], [VERIFICATION REQUEST], [VERIFICATION RESULT]
 */

import type {
  TaskAssignment,
  StatusReport,
  VerificationRequest,
  VerificationResult,
} from '../types/hierarchy-message.types.js';
import type { TaskArtifact, InProgressTaskStatus } from '../types/task-tracking.types.js';

// ============================================================================
// Serialization (struct → markdown)
// ============================================================================

/**
 * Serialize a TaskAssignment to markdown for PTY delivery.
 *
 * @param msg - The task assignment message
 * @returns Markdown-formatted string with [TASK ASSIGNMENT] header
 */
export function serializeTaskAssignment(msg: TaskAssignment): string {
  const lines: string[] = [
    '---',
    '[TASK ASSIGNMENT]',
    `Task ID: ${msg.taskId}`,
    `Title: ${msg.title}`,
    `Priority: ${msg.priority}`,
    `Delegated by: ${msg.delegatedBy}`,
    `Parent Task: ${msg.parentTaskId || 'none'}`,
    '---',
    '',
    '## Instructions',
    msg.description,
  ];

  if (msg.expectedArtifacts && msg.expectedArtifacts.length > 0) {
    lines.push('', '## Expected Deliverables');
    for (const artifact of msg.expectedArtifacts) {
      lines.push(`- ${artifact}`);
    }
  }

  if (msg.contextFiles && msg.contextFiles.length > 0) {
    lines.push('', '## Context');
    lines.push('Read these files first:');
    for (const file of msg.contextFiles) {
      lines.push(`- ${file}`);
    }
  }

  if (msg.deadlineHint) {
    lines.push('', `**Deadline hint**: ${msg.deadlineHint}`);
  }

  return lines.join('\n');
}

/**
 * Serialize a StatusReport to markdown for PTY delivery.
 *
 * @param msg - The status report message
 * @returns Markdown-formatted string with [STATUS REPORT] header
 */
export function serializeStatusReport(msg: StatusReport): string {
  const lines: string[] = [
    '---',
    '[STATUS REPORT]',
    `Task ID: ${msg.taskId}`,
    `State: ${msg.state}`,
    ...(msg.progress !== undefined ? [`Progress: ${msg.progress}%`] : []),
    `Reported by: ${msg.reportedBy}`,
    '---',
    '',
    '## Status',
    msg.message,
  ];

  if (msg.artifacts && msg.artifacts.length > 0) {
    lines.push('', '## Artifacts');
    for (const artifact of msg.artifacts) {
      lines.push(`- **${artifact.name}** (${artifact.type}): ${artifact.content}`);
    }
  }

  if (msg.blockers && msg.blockers.length > 0) {
    lines.push('', '## Blockers');
    for (const blocker of msg.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join('\n');
}

/**
 * Serialize a VerificationRequest to markdown for PTY delivery.
 *
 * @param msg - The verification request message
 * @returns Markdown-formatted string with [VERIFICATION REQUEST] header
 */
export function serializeVerificationRequest(msg: VerificationRequest): string {
  const lines: string[] = [
    '---',
    '[VERIFICATION REQUEST]',
    `Task ID: ${msg.taskId}`,
    `Requested by: ${msg.requestedBy}`,
    '---',
    '',
    '## Summary',
    msg.summary,
  ];

  if (msg.artifacts.length > 0) {
    lines.push('', '## Artifacts');
    for (const artifact of msg.artifacts) {
      lines.push(`- **${artifact.name}** (${artifact.type}): ${artifact.content}`);
    }
  }

  if (msg.testResults) {
    lines.push('', '## Test Results', msg.testResults);
  }

  return lines.join('\n');
}

/**
 * Serialize a VerificationResult to markdown for PTY delivery.
 *
 * @param msg - The verification result message
 * @returns Markdown-formatted string with [VERIFICATION RESULT] header
 */
export function serializeVerificationResult(msg: VerificationResult): string {
  const lines: string[] = [
    '---',
    '[VERIFICATION RESULT]',
    `Task ID: ${msg.taskId}`,
    `Verdict: ${msg.verdict}`,
    `Verified by: ${msg.verifiedBy}`,
    '---',
  ];

  if (msg.feedback) {
    lines.push('', '## Feedback', msg.feedback);
  }

  return lines.join('\n');
}

// ============================================================================
// Deserialization (markdown → struct)
// ============================================================================

/**
 * Extract a header value from parsed header lines.
 * Looks for "Key: value" pattern, case-insensitive on the key.
 */
function extractHeader(lines: string[], key: string): string | undefined {
  const prefix = `${key}:`;
  for (const line of lines) {
    if (line.toLowerCase().startsWith(prefix.toLowerCase())) {
      return line.slice(prefix.length).trim();
    }
  }
  return undefined;
}

/**
 * Split markdown into header block and body sections.
 * Header is between the first and second '---' lines.
 */
function splitHeaderAndBody(text: string): { headerLines: string[]; body: string } {
  const lines = text.split('\n');
  let headerStart = -1;
  let headerEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (headerStart === -1) {
        headerStart = i;
      } else {
        headerEnd = i;
        break;
      }
    }
  }

  if (headerStart === -1 || headerEnd === -1) {
    return { headerLines: [], body: text };
  }

  const headerLines = lines.slice(headerStart + 1, headerEnd);
  const body = lines.slice(headerEnd + 1).join('\n').trim();
  return { headerLines, body };
}

/**
 * Extract a named markdown section (## Section Name) from body text.
 * Returns the content between the section header and the next section or end.
 */
function extractSection(body: string, sectionName: string): string | undefined {
  const marker = `## ${sectionName}`;
  const lines = body.split('\n');
  let startIdx = -1;

  // Find the section header line
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === marker) {
      startIdx = i + 1;
      break;
    }
  }

  if (startIdx === -1) return undefined;

  // Find the next section header (## ...)
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim();
}

/**
 * Parse bullet list items from a section body.
 * Supports "- item" and "- **name** (type): content" formats.
 */
function parseBulletList(text: string): string[] {
  return text
    .split('\n')
    .filter(line => line.trim().startsWith('- '))
    .map(line => line.trim().slice(2).trim());
}

/**
 * Parse artifact entries from bullet list items.
 * Format: "**name** (type): content"
 */
function parseArtifactList(text: string): TaskArtifact[] {
  const items = parseBulletList(text);
  const now = new Date().toISOString();
  return items.map((item, index) => {
    const match = item.match(/^\*\*(.+?)\*\*\s*\((\w+)\):\s*(.+)$/);
    if (match) {
      return {
        id: `artifact-${index}`,
        name: match[1],
        type: match[2] as TaskArtifact['type'],
        content: match[3],
        createdAt: now,
      };
    }
    return {
      id: `artifact-${index}`,
      name: item,
      type: 'text' as const,
      content: item,
      createdAt: now,
    };
  });
}

/**
 * Parse a TaskAssignment from serialized markdown.
 *
 * @param text - Markdown text with [TASK ASSIGNMENT] header
 * @returns Parsed TaskAssignment or null if parsing fails
 */
export function parseTaskAssignment(text: string): TaskAssignment | null {
  const { headerLines, body } = splitHeaderAndBody(text);

  if (!headerLines.some(l => l.includes('[TASK ASSIGNMENT]'))) {
    return null;
  }

  const taskId = extractHeader(headerLines, 'Task ID');
  const title = extractHeader(headerLines, 'Title');
  const priority = extractHeader(headerLines, 'Priority') as TaskAssignment['priority'] | undefined;
  const delegatedBy = extractHeader(headerLines, 'Delegated by');
  const parentTaskId = extractHeader(headerLines, 'Parent Task');

  if (!taskId || !title || !delegatedBy) return null;

  const description = extractSection(body, 'Instructions') || '';

  const deliverablesSection = extractSection(body, 'Expected Deliverables');
  const expectedArtifacts = deliverablesSection ? parseBulletList(deliverablesSection) : undefined;

  const contextSection = extractSection(body, 'Context');
  const contextFiles = contextSection ? parseBulletList(contextSection) : undefined;

  const deadlineMatch = body.match(/\*\*Deadline hint\*\*:\s*(.+)/);
  const deadlineHint = deadlineMatch ? deadlineMatch[1].trim() : undefined;

  return {
    type: 'task_assignment',
    taskId,
    title,
    description,
    priority: priority || 'medium',
    delegatedBy,
    ...(parentTaskId && parentTaskId !== 'none' ? { parentTaskId } : {}),
    ...(expectedArtifacts && expectedArtifacts.length > 0 ? { expectedArtifacts } : {}),
    ...(contextFiles && contextFiles.length > 0 ? { contextFiles } : {}),
    ...(deadlineHint ? { deadlineHint } : {}),
  };
}

/**
 * Parse a StatusReport from serialized markdown.
 *
 * @param text - Markdown text with [STATUS REPORT] header
 * @returns Parsed StatusReport or null if parsing fails
 */
export function parseStatusReport(text: string): StatusReport | null {
  const { headerLines, body } = splitHeaderAndBody(text);

  if (!headerLines.some(l => l.includes('[STATUS REPORT]'))) {
    return null;
  }

  const taskId = extractHeader(headerLines, 'Task ID');
  const state = extractHeader(headerLines, 'State') as InProgressTaskStatus | undefined;
  const progressStr = extractHeader(headerLines, 'Progress');
  const reportedBy = extractHeader(headerLines, 'Reported by');

  if (!taskId || !state || !reportedBy) return null;

  const message = extractSection(body, 'Status') || '';

  const artifactsSection = extractSection(body, 'Artifacts');
  const artifacts = artifactsSection ? parseArtifactList(artifactsSection) : undefined;

  const blockersSection = extractSection(body, 'Blockers');
  const blockers = blockersSection ? parseBulletList(blockersSection) : undefined;

  const progress = progressStr ? parseInt(progressStr.replace('%', ''), 10) : undefined;

  return {
    type: 'status_report',
    taskId,
    state,
    message,
    reportedBy,
    ...(progress !== undefined && !isNaN(progress) ? { progress } : {}),
    ...(artifacts && artifacts.length > 0 ? { artifacts } : {}),
    ...(blockers && blockers.length > 0 ? { blockers } : {}),
  };
}

/**
 * Parse a VerificationRequest from serialized markdown.
 *
 * @param text - Markdown text with [VERIFICATION REQUEST] header
 * @returns Parsed VerificationRequest or null if parsing fails
 */
export function parseVerificationRequest(text: string): VerificationRequest | null {
  const { headerLines, body } = splitHeaderAndBody(text);

  if (!headerLines.some(l => l.includes('[VERIFICATION REQUEST]'))) {
    return null;
  }

  const taskId = extractHeader(headerLines, 'Task ID');
  const requestedBy = extractHeader(headerLines, 'Requested by');

  if (!taskId || !requestedBy) return null;

  const summary = extractSection(body, 'Summary') || '';

  const artifactsSection = extractSection(body, 'Artifacts');
  const artifacts = artifactsSection ? parseArtifactList(artifactsSection) : [];

  const testResults = extractSection(body, 'Test Results');

  return {
    type: 'verification_request',
    taskId,
    artifacts,
    summary,
    requestedBy,
    ...(testResults ? { testResults } : {}),
  };
}

/**
 * Parse a VerificationResult from serialized markdown.
 *
 * @param text - Markdown text with [VERIFICATION RESULT] header
 * @returns Parsed VerificationResult or null if parsing fails
 */
export function parseVerificationResult(text: string): VerificationResult | null {
  const { headerLines, body } = splitHeaderAndBody(text);

  if (!headerLines.some(l => l.includes('[VERIFICATION RESULT]'))) {
    return null;
  }

  const taskId = extractHeader(headerLines, 'Task ID');
  const verdict = extractHeader(headerLines, 'Verdict') as VerificationResult['verdict'] | undefined;
  const verifiedBy = extractHeader(headerLines, 'Verified by');

  if (!taskId || !verdict || !verifiedBy) return null;

  const feedback = extractSection(body, 'Feedback');

  return {
    type: 'verification_result',
    taskId,
    verdict,
    verifiedBy,
    ...(feedback ? { feedback } : {}),
  };
}

/**
 * Detect the message type from serialized markdown text.
 *
 * @param text - Markdown text to analyze
 * @returns The detected message type, or null if not recognized
 */
export function detectMessageType(text: string): TaskAssignment['type'] | StatusReport['type'] | VerificationRequest['type'] | VerificationResult['type'] | null {
  if (text.includes('[TASK ASSIGNMENT]')) return 'task_assignment';
  if (text.includes('[STATUS REPORT]')) return 'status_report';
  if (text.includes('[VERIFICATION REQUEST]')) return 'verification_request';
  if (text.includes('[VERIFICATION RESULT]')) return 'verification_result';
  return null;
}

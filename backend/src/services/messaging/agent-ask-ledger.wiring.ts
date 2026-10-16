/**
 * Boot wiring of the agent ask ledger: the store file, the transcript reader
 * and the delivery used to hand an unsent answer to its asker.
 *
 * @module services/messaging/agent-ask-ledger.wiring
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { collectSecretEnvValues } from '../../utils/secret-env.js';
import { redactSecrets } from '../../utils/secret-redactor.js';
import {
	AGENT_ASK_CONSTANTS,
	AgentAskLedger,
	agentAskReturnEnabled,
	lastWordsFromTranscript,
	setAgentAskLedger,
} from './agent-ask-ledger.service.js';

/** Bytes read from the end of a transcript: a long turn's last message is near the end. */
export const LAST_WORDS_TAIL_BYTES = 2 * 1024 * 1024;

/** Where a session's transcript is (see the canvas transcript locator). */
export type AskTranscriptLocator = (session: string) => Promise<{ kind: 'claude' | 'codex'; file: string } | null>;

/**
 * Read the end of a file as whole lines (the first partial line is dropped).
 *
 * @param file - Path
 * @param maxBytes - Bytes from the end
 * @returns Text
 */
export async function readTail(file: string, maxBytes: number = LAST_WORDS_TAIL_BYTES): Promise<string> {
	const handle = await fs.open(file, 'r');
	try {
		const { size } = await handle.stat();
		const start = Math.max(0, size - maxBytes);
		const buf = Buffer.alloc(size - start);
		await handle.read(buf, 0, buf.length, start);
		const text = buf.toString('utf-8');
		return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
	} finally {
		await handle.close();
	}
}

/**
 * The last words of a session since a time, secrets masked.
 *
 * @param locate - Transcript locator
 * @param session - Agent session
 * @param sinceMs - Oldest entry to read (epoch ms)
 * @returns Text, or null (no transcript, nothing said)
 */
export async function readLastWords(locate: AskTranscriptLocator, session: string, sinceMs: number): Promise<string | null> {
	const target = await locate(session);
	if (!target) return null;
	const words = lastWordsFromTranscript(await readTail(target.file), target.kind, sinceMs);
	return words ? redactSecrets(words, collectSecretEnvValues(process.env)) : null;
}

/**
 * Create and expose the ledger. Returns null when switched off.
 *
 * @param deps.crewlyHome - CREWLY_HOME (store file location)
 * @param deps.sendToAgent - Delivers a harness message to an agent
 * @param deps.locate - Transcript locator
 * @returns The ledger, or null
 */
export function createAgentAskLedger(deps: {
	crewlyHome: string;
	sendToAgent: (session: string, text: string) => Promise<unknown>;
	locate: AskTranscriptLocator;
}): AgentAskLedger | null {
	if (!agentAskReturnEnabled()) {
		setAgentAskLedger(null);
		return null;
	}
	const ledger = new AgentAskLedger({
		file: path.join(deps.crewlyHome, AGENT_ASK_CONSTANTS.FILE_NAME),
		readLastWords: (session, sinceMs) => readLastWords(deps.locate, session, sinceMs),
		deliver: deps.sendToAgent,
	});
	setAgentAskLedger(ledger);
	return ledger;
}

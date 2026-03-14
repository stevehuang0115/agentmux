/**
 * Context Flush Service (#153)
 *
 * Automatically extracts and persists critical context before autonomous
 * context compaction. Prevents loss of important details like task progress,
 * decisions, API ports, and user preferences that haven't been explicitly
 * remembered.
 *
 * Integration point: Called before context compaction in agent sessions.
 *
 * @see https://github.com/stevehuang0115/crewly/issues/153
 * @module services/memory/context-flush.service
 */

import { LoggerService, type ComponentLogger } from '../core/logger.service.js';

/** Extracted context item from conversation text */
export interface ExtractedContextItem {
	/** Category of the extracted context */
	category: 'task_progress' | 'decision' | 'technical_detail' | 'preference' | 'blocker';
	/** Extracted content */
	content: string;
	/** Confidence score (0-1) */
	confidence: number;
}

/** Result of a context flush operation */
export interface ContextFlushResult {
	/** Number of items extracted */
	extractedCount: number;
	/** Number of items saved to memory */
	savedCount: number;
	/** Items that were extracted */
	items: ExtractedContextItem[];
}

/**
 * Patterns that indicate critical context worth preserving.
 * Each pattern maps to a category and has a confidence boost.
 */
const EXTRACTION_PATTERNS: Array<{
	pattern: RegExp;
	category: ExtractedContextItem['category'];
	confidence: number;
}> = [
	// Task progress indicators
	{ pattern: /(?:current(?:ly)?|now)\s+(?:working on|implementing|fixing|debugging)\s+(.{10,100})/i, category: 'task_progress', confidence: 0.9 },
	{ pattern: /(?:completed|finished|done with)\s+(.{10,100})/i, category: 'task_progress', confidence: 0.85 },
	{ pattern: /(?:remaining|left to do|todo|next step):\s*(.{10,100})/i, category: 'task_progress', confidence: 0.85 },
	{ pattern: /(?:blocked|stuck|waiting)\s+(?:on|for)\s+(.{10,100})/i, category: 'blocker', confidence: 0.9 },

	// Decisions
	{ pattern: /(?:decided|decision|chose|will use|going with)\s+(.{10,100})/i, category: 'decision', confidence: 0.8 },
	{ pattern: /(?:instead of|rather than|not using)\s+(.{10,100})/i, category: 'decision', confidence: 0.75 },

	// Technical details
	{ pattern: /(?:port|endpoint|url|api)(?:\s+is|\s*:|\s*=)\s*(\S+)/i, category: 'technical_detail', confidence: 0.85 },
	{ pattern: /(?:file|path|directory)(?:\s+is|\s*:|\s*=)\s*(\S+)/i, category: 'technical_detail', confidence: 0.8 },
	{ pattern: /(?:version|v)(?:\s+is|\s*:|\s*=)\s*(\S+)/i, category: 'technical_detail', confidence: 0.75 },

	// Preferences
	{ pattern: /(?:user|they)\s+(?:wants?|prefers?|asked for)\s+(.{10,100})/i, category: 'preference', confidence: 0.8 },
	{ pattern: /(?:don't|do not|should not|avoid)\s+(.{10,80})/i, category: 'preference', confidence: 0.75 },
];

/**
 * ContextFlushService extracts critical context from conversation text
 * and persists it to the memory system before compaction.
 */
export class ContextFlushService {
	private static instance: ContextFlushService | null = null;
	private readonly logger: ComponentLogger;

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('ContextFlush');
	}

	static getInstance(): ContextFlushService {
		if (!ContextFlushService.instance) {
			ContextFlushService.instance = new ContextFlushService();
		}
		return ContextFlushService.instance;
	}

	static resetInstance(): void {
		ContextFlushService.instance = null;
	}

	/**
	 * Extract critical context items from conversation text.
	 *
	 * Uses pattern matching to identify task progress, decisions,
	 * technical details, and preferences worth preserving.
	 *
	 * @param text - Conversation text to extract from
	 * @param minConfidence - Minimum confidence threshold (default: 0.7)
	 * @returns Array of extracted context items
	 */
	extract(text: string, minConfidence: number = 0.7): ExtractedContextItem[] {
		const items: ExtractedContextItem[] = [];
		const seen = new Set<string>();

		for (const { pattern, category, confidence } of EXTRACTION_PATTERNS) {
			const matches = text.matchAll(new RegExp(pattern, 'gi'));
			for (const match of matches) {
				const content = (match[1] || match[0]).trim();
				if (content.length < 5 || seen.has(content.toLowerCase())) continue;

				if (confidence >= minConfidence) {
					seen.add(content.toLowerCase());
					items.push({ category, content, confidence });
				}
			}
		}

		// Sort by confidence descending
		items.sort((a, b) => b.confidence - a.confidence);

		// Cap at 20 items to avoid noise
		return items.slice(0, 20);
	}

	/**
	 * Flush critical context to the memory system.
	 *
	 * Extracts context items from conversation text and calls the
	 * remember API for each item that meets the confidence threshold.
	 *
	 * @param text - Conversation text to flush
	 * @param agentId - Agent ID for memory storage
	 * @param projectPath - Project path for project-scoped storage
	 * @param rememberFn - Function to persist a memory item
	 * @returns Flush result with counts
	 */
	async flush(
		text: string,
		agentId: string,
		projectPath: string,
		rememberFn: (params: { agentId: string; content: string; category: string; scope: string; projectPath: string }) => Promise<void>,
	): Promise<ContextFlushResult> {
		const items = this.extract(text);

		let savedCount = 0;
		for (const item of items) {
			try {
				const memoryCategory = item.category === 'task_progress' ? 'fact'
					: item.category === 'decision' ? 'decision'
					: item.category === 'technical_detail' ? 'fact'
					: item.category === 'preference' ? 'preference'
					: 'gotcha';

				await rememberFn({
					agentId,
					content: `[auto-flush] ${item.content}`,
					category: memoryCategory,
					scope: 'project',
					projectPath,
				});
				savedCount++;
			} catch (err) {
				this.logger.warn('Failed to save context item', {
					category: item.category,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		this.logger.info('Context flush complete', {
			extractedCount: items.length,
			savedCount,
			agentId,
		});

		return { extractedCount: items.length, savedCount, items };
	}
}

/**
 * Request Controller — HTTP handlers for V3 Request API
 *
 * Endpoints:
 * - GET  /api/requests       — list all Requests
 * - GET  /api/requests/:id   — get a single Request
 * - POST /api/requests       — create a Request
 * - POST /api/requests/plan  — plan tasks from a user message
 * - PUT  /api/requests/:id   — update a Request
 * - GET  /api/requests/:id/whereabouts — who holds it now, doing what, since when
 *
 * @module controllers/request/request.controller
 */

import type { Request as ExpressRequest, Response } from 'express';
import { RequestService } from '../../services/v3/request.service.js';
import type { CreateRequestInput, UpdateRequestInput } from '../../types/v2/index.js';
import { readAgentSessionHeader } from '../../utils/agent-caller.utils.js';
import { ensureTraceForSession } from '../../services/trace/trace-recorder.js';
import { TaskPoolService } from '../../services/task-pool/task-pool.service.js';
import { getAgentAskLedger } from '../../services/messaging/agent-ask-ledger.service.js';
import { computeWhereabouts } from '../../services/v3/request-whereabouts.service.js';
import type { Request as CrewlyRequest } from '../../types/v2/request.types.js';

/**
 * Gets the RequestService singleton.
 *
 * @returns RequestService instance
 */
function getService(): RequestService {
  return RequestService.getInstance();
}

// ---------------------------------------------------------------------------
// GET /api/requests — List all Requests
// ---------------------------------------------------------------------------

/**
 * Returns all Requests, sorted by createdAt descending.
 *
 * @param req - Express request
 * @param res - Express response with Request array
 */
export async function listRequests(req: ExpressRequest, res: Response): Promise<void> {
  try {
    const requests = await getService().listAll();
    res.json({ success: true, data: requests, count: requests.length });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/requests/:id — Get a single Request
// ---------------------------------------------------------------------------

/**
 * Returns a single Request by ID.
 *
 * @param req - Express request with id param
 * @param res - Express response with Request or 404
 */
export async function getRequest(req: ExpressRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'id param is required' });
      return;
    }

    const request = await getService().getById(id);
    if (!request) {
      res.status(404).json({ success: false, error: `Request not found: ${id}` });
      return;
    }

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}

/**
 * Find a Request by id, or by its ticket number (`TKT-12` or `12`).
 *
 * @param ref - Request id or ticket number
 * @returns The Request, or null
 */
async function findRequest(ref: string): Promise<CrewlyRequest | null> {
  const byId = await getService().getById(ref);
  if (byId) return byId;
  const m = /^(?:TKT-)?(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return (await getService().listAll()).find((r) => r.ticketNumber === n) ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/requests/:id/whereabouts — where the Request is now
// ---------------------------------------------------------------------------

/**
 * Who holds a Request now, doing what, since when: its open WorkItems (the
 * worker, or the reviewer once the worker is done) and agent-to-agent
 * hand-offs from the ask ledger. See services/v3/request-whereabouts.service.ts.
 *
 * Responses: 200 `{success, data: RequestWhereabouts}`, 404 unknown request.
 *
 * @param req - Express request with id param (request id or `TKT-n`)
 * @param res - Express response
 */
export async function getRequestWhereabouts(req: ExpressRequest, res: Response): Promise<void> {
  try {
    const request = await findRequest(req.params.id ?? '');
    if (!request) {
      res.status(404).json({ success: false, error: `Request not found: ${req.params.id}` });
      return;
    }
    const items = await TaskPoolService.getInstance().getAllItems();
    const asks = getAgentAskLedger()?.openAsks() ?? [];
    res.json({ success: true, data: computeWhereabouts(request, items, asks, Date.now()) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/requests — Create a Request
// ---------------------------------------------------------------------------

/**
 * Creates a new Request.
 *
 * Request body: CreateRequestInput fields
 *
 * @param req - Express request with CreateRequestInput body
 * @param res - Express response with the created Request
 */
export async function createRequestHandler(req: ExpressRequest, res: Response): Promise<void> {
  try {
    const body = req.body as CreateRequestInput;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a non-null object' });
      return;
    }

    // An agent creating a ticket mid-run keeps it in its run's trace.
    const callerTrace = body.traceId ? undefined : ensureTraceForSession(readAgentSessionHeader(req));
    const request = await getService().create(callerTrace ? { ...body, traceId: callerTrace } : body);

    // P2-2: RequestTracker.setActiveRequest write removed. The companion
    // read in v3-data.service.ts no longer falls back to time-window
    // correlation, so writing here would be dead code. All delegations
    // must now pass requestId explicitly via --request-id.

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Invalid CreateRequestInput')) {
      res.status(400).json({ success: false, error: message });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/requests/plan — Plan tasks from a user message
// ---------------------------------------------------------------------------

/**
 * Decomposes a user message into proposed ProjectTasks.
 *
 * Request body: `{ message: string }`
 *
 * Returns the decomposition plan with tasks, strategy, and reasoning.
 *
 * @param req - Express request with `{ message }` body
 * @param res - Express response with RequestPlan
 */
export async function planRequest(req: ExpressRequest, res: Response): Promise<void> {
  try {
    const { message, options } = req.body as {
      message?: string;
      options?: { maxTasks?: number; defaultPriority?: 'high' | 'medium' | 'low' };
    };

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'message field is required and must be a string' });
      return;
    }

    const plan = await getService().plan(message, options);
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/requests/:id — Update a Request
// ---------------------------------------------------------------------------

/**
 * Updates an existing Request with partial fields.
 *
 * @param req - Express request with id param and UpdateRequestInput body
 * @param res - Express response with the updated Request
 */
export async function updateRequest(req: ExpressRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'id param is required' });
      return;
    }

    const updates = req.body as UpdateRequestInput;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a non-null object' });
      return;
    }

    const request = await getService().update(id, updates);
    res.json({ success: true, data: request });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ success: false, error: message });
    } else if (message.includes('Invalid status transition')) {
      res.status(409).json({ success: false, error: message });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
}

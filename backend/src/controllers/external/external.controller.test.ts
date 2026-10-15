import type { Request, Response } from 'express';

const mockService = { reply: jest.fn(), hostCall: jest.fn(), listEmbeds: jest.fn(), attachEmbed: jest.fn(), detachEmbed: jest.fn() };
jest.mock('../../services/external/external.wiring.js', () => ({ getExternalParts: () => ({ service: mockService }) }));
let mockSession: string | undefined;
jest.mock('../../middleware/caller-identity.middleware.js', () => ({ callerAgentSession: () => mockSession }));

import { ExternalError } from '../../services/external/external.service.js';
import { deleteEmbed, postHostApi, postReply, putEmbed } from './external.controller.js';

interface FakeRes {
	statusCode: number;
	body: unknown;
	status(c: number): FakeRes;
	json(b: unknown): FakeRes;
}

function res(): FakeRes & Response {
	const r: FakeRes = {
		statusCode: 200,
		body: undefined,
		status(c) {
			r.statusCode = c;
			return r;
		},
		json(b) {
			r.body = b;
			return r;
		},
	};
	return r as unknown as FakeRes & Response;
}

describe('external controller', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSession = 'avery-1';
	});

	it('passes the agent caller and body to reply', async () => {
		mockService.reply.mockResolvedValue({ sent: true });
		const r = res();
		await postReply({ body: { conversation: 'ext-aaaaaaaaaaaa', text: 'hi' } } as Request, r);
		expect(mockService.reply).toHaveBeenCalledWith({ kind: 'agent', session: 'avery-1' }, 'ext-aaaaaaaaaaaa', 'hi');
		expect(r.body).toEqual({ success: true, data: { sent: true } });
	});

	it('maps a blocked reply to 422 with reasons', async () => {
		mockService.reply.mockRejectedValue(new ExternalError(422, 'reply_blocked', 'Not sent', { reasons: ['secret'] }));
		const r = res();
		await postReply({ body: { conversation: 'ext-aaaaaaaaaaaa', text: 'x' } } as Request, r);
		expect(r.statusCode).toBe(422);
		expect(r.body).toEqual({ success: false, error: 'reply_blocked', message: 'Not sent', reasons: ['secret'] });
	});

	it('treats a non-agent caller as the owner on host-api', async () => {
		mockSession = undefined;
		mockService.hostCall.mockResolvedValue({ status: 200 });
		await postHostApi({ body: { conversation: 'ext-aaaaaaaaaaaa', method: 'GET', path: '/me' } } as Request, res());
		expect(mockService.hostCall).toHaveBeenCalledWith({ kind: 'owner' }, 'ext-aaaaaaaaaaaa', 'GET', '/me', undefined);
	});

	it('attaches and detaches embeds', async () => {
		mockService.attachEmbed.mockReturnValue({ embedId: 'emb_portal1', frontAgent: 'avery-1' });
		await putEmbed({ params: { embedId: 'emb_portal1' }, body: { frontAgent: 'avery-1', label: 'Portal' } } as unknown as Request, res());
		expect(mockService.attachEmbed).toHaveBeenCalledWith({ embedId: 'emb_portal1', frontAgent: 'avery-1', label: 'Portal' });
		const r = res();
		await deleteEmbed({ params: { embedId: 'emb_portal1' } } as unknown as Request, r);
		expect(r.body).toEqual({ success: true, data: { detached: 'emb_portal1' } });
	});

	it('hides unexpected errors', async () => {
		mockService.reply.mockRejectedValue(new Error('boom /Users/x'));
		const r = res();
		await postReply({ body: {} } as Request, r);
		expect(r.statusCode).toBe(500);
		expect(JSON.stringify(r.body)).not.toContain('/Users');
	});
});

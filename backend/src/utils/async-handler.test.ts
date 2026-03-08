/**
 * Tests for the shared async handler utility.
 *
 * @module utils/async-handler.test
 */

import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './async-handler.js';

describe('asyncHandler', () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		mockReq = {};
		mockRes = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};
		mockNext = jest.fn();
	});

	it('should call the wrapped handler with req, res, next', async () => {
		const handler = jest.fn().mockResolvedValue(undefined);
		const wrapped = asyncHandler(handler);

		await wrapped(mockReq as Request, mockRes as Response, mockNext);

		expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
	});

	it('should return 500 with error message when handler throws an Error', async () => {
		const handler = jest.fn().mockRejectedValue(new Error('something broke'));
		const wrapped = asyncHandler(handler);

		await wrapped(mockReq as Request, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(500);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: 'something broke',
		});
	});

	it('should stringify non-Error throws', async () => {
		const handler = jest.fn().mockRejectedValue('string error');
		const wrapped = asyncHandler(handler);

		await wrapped(mockReq as Request, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(500);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: 'string error',
		});
	});

	it('should not interfere when handler succeeds', async () => {
		const handler = jest.fn().mockImplementation(async (_req, res) => {
			res.json({ success: true });
		});
		const wrapped = asyncHandler(handler);

		await wrapped(mockReq as Request, mockRes as Response, mockNext);

		expect(mockRes.json).toHaveBeenCalledWith({ success: true });
		expect(mockRes.status).not.toHaveBeenCalled();
	});
});

/**
 * Tests for shared authentication utilities.
 *
 * @module services/cloud/auth/auth.utils.test
 */

import type { Request } from 'express';
import {
	extractBearerToken,
	MIN_PASSWORD_LENGTH,
	EMAIL_REGEX,
} from './auth.utils.js';

describe('auth.utils', () => {
	describe('extractBearerToken', () => {
		it('should extract token from valid Bearer header', () => {
			const req = {
				headers: { authorization: 'Bearer abc123token' },
			} as unknown as Request;

			expect(extractBearerToken(req)).toBe('abc123token');
		});

		it('should return null when no Authorization header', () => {
			const req = { headers: {} } as Request;
			expect(extractBearerToken(req)).toBeNull();
		});

		it('should return null when Authorization header is not Bearer', () => {
			const req = {
				headers: { authorization: 'Basic abc123' },
			} as unknown as Request;

			expect(extractBearerToken(req)).toBeNull();
		});

		it('should return null when Authorization header is empty', () => {
			const req = {
				headers: { authorization: '' },
			} as unknown as Request;

			expect(extractBearerToken(req)).toBeNull();
		});

		it('should handle tokens with special characters', () => {
			const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';
			const req = {
				headers: { authorization: `Bearer ${token}` },
			} as unknown as Request;

			expect(extractBearerToken(req)).toBe(token);
		});
	});

	describe('MIN_PASSWORD_LENGTH', () => {
		it('should be 8', () => {
			expect(MIN_PASSWORD_LENGTH).toBe(8);
		});
	});

	describe('EMAIL_REGEX', () => {
		it('should match valid emails', () => {
			expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
			expect(EMAIL_REGEX.test('user+tag@domain.co')).toBe(true);
			expect(EMAIL_REGEX.test('a@b.c')).toBe(true);
		});

		it('should reject invalid emails', () => {
			expect(EMAIL_REGEX.test('')).toBe(false);
			expect(EMAIL_REGEX.test('nodomain')).toBe(false);
			expect(EMAIL_REGEX.test('@nope.com')).toBe(false);
			expect(EMAIL_REGEX.test('no spaces@mail.com')).toBe(false);
		});
	});
});

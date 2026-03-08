/**
 * Tests for Auth barrel exports
 *
 * @module components/Auth/index.test
 */

import { describe, it, expect } from 'vitest';
import {
  LoginForm,
  RegisterForm,
  CloudAuthModal,
  AuthStatusIndicator,
} from './index';

describe('Auth barrel exports', () => {
  it('should export LoginForm', () => {
    expect(LoginForm).toBeDefined();
  });

  it('should export RegisterForm', () => {
    expect(RegisterForm).toBeDefined();
  });

  it('should export CloudAuthModal', () => {
    expect(CloudAuthModal).toBeDefined();
  });

  it('should export AuthStatusIndicator', () => {
    expect(AuthStatusIndicator).toBeDefined();
  });
});

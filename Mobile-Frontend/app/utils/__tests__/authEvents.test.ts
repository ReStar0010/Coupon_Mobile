/**
 * Unit tests for authEvents - subscribe, emit, clear, listener errors
 */

import * as Sentry from '@sentry/react-native';
import {
  authEvents,
  AUTH_EVENT_TYPES,
  type AuthEventType,
  type AuthEventListener,
} from '../authEvents';

describe('authEvents', () => {
  beforeEach(() => {
    authEvents.clear();
    jest.clearAllMocks();
  });

  describe('AUTH_EVENT_TYPES', () => {
    it('exports all event type constants', () => {
      expect(AUTH_EVENT_TYPES.AUTH_FAILURE).toBe('AUTH_FAILURE');
      expect(AUTH_EVENT_TYPES.LOGOUT_REQUESTED).toBe('LOGOUT_REQUESTED');
      expect(AUTH_EVENT_TYPES.SESSION_REFRESHED).toBe('SESSION_REFRESHED');
    });
  });

  describe('subscribe and emit', () => {
    it('calls listener when event of same type is emitted', () => {
      const listener = jest.fn();
      authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, listener);
      const event = { type: AUTH_EVENT_TYPES.AUTH_FAILURE, reason: 'no_refresh_token' };

      authEvents.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('does not call listener when different event type is emitted', () => {
      const listener = jest.fn();
      authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, listener);

      authEvents.emit({ type: AUTH_EVENT_TYPES.LOGOUT_REQUESTED });

      expect(listener).not.toHaveBeenCalled();
    });

    it('calls all subscribers for the same type', () => {
      const l1 = jest.fn();
      const l2 = jest.fn();
      authEvents.subscribe(AUTH_EVENT_TYPES.SESSION_REFRESHED, l1);
      authEvents.subscribe(AUTH_EVENT_TYPES.SESSION_REFRESHED, l2);
      const event = { type: AUTH_EVENT_TYPES.SESSION_REFRESHED };

      authEvents.emit(event);

      expect(l1).toHaveBeenCalledWith(event);
      expect(l2).toHaveBeenCalledWith(event);
    });

    it('unsubscribe stops future calls', () => {
      const listener = jest.fn();
      const unsubscribe = authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, listener);

      authEvents.emit({ type: AUTH_EVENT_TYPES.AUTH_FAILURE });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      authEvents.emit({ type: AUTH_EVENT_TYPES.AUTH_FAILURE });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('listener errors', () => {
    it('catches listener throw and reports to Sentry, other listeners still run', () => {
      const throwing = jest.fn(() => {
        throw new Error('listener error');
      });
      const other = jest.fn();
      authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, throwing);
      authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, other);

      authEvents.emit({ type: AUTH_EVENT_TYPES.AUTH_FAILURE, reason: 'test' });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'AUTH_FAILURE' }) }),
      );
      expect(other).toHaveBeenCalled();
    });
  });

  describe('clear and getListenerCount', () => {
    it('clear removes all listeners', () => {
      authEvents.subscribe(AUTH_EVENT_TYPES.AUTH_FAILURE, jest.fn());
      expect(authEvents.getListenerCount(AUTH_EVENT_TYPES.AUTH_FAILURE)).toBe(1);

      authEvents.clear();
      expect(authEvents.getListenerCount(AUTH_EVENT_TYPES.AUTH_FAILURE)).toBe(0);
    });

    it('getListenerCount returns 0 for type with no listeners', () => {
      expect(authEvents.getListenerCount(AUTH_EVENT_TYPES.LOGOUT_REQUESTED)).toBe(0);
    });
  });
});

/**
 * Auth Events - Event emitter for authentication state changes
 *
 * This module provides a centralized event system for auth-related events,
 * allowing any part of the app to signal auth failures without importing navigation.
 */

// import * as Sentry from '@sentry/react-native';

export type AuthEventType = 'AUTH_FAILURE' | 'LOGOUT_REQUESTED' | 'SESSION_REFRESHED';

export interface AuthEvent {
  type: AuthEventType;
  reason?: string;
  returnUrl?: string;
}

export type AuthEventListener = (event: AuthEvent) => void;

/**
 * Event types as constants for type-safe usage
 */
export const AUTH_EVENT_TYPES = {
  AUTH_FAILURE: 'AUTH_FAILURE',
  LOGOUT_REQUESTED: 'LOGOUT_REQUESTED',
  SESSION_REFRESHED: 'SESSION_REFRESHED',
} as const;

/**
 * Singleton event emitter for auth events
 */
class AuthEventEmitter {
  private listeners: Map<AuthEventType, Set<AuthEventListener>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an auth event
   * @param type Event type to subscribe to
   * @param listener Callback function to call when event is emitted
   * @returns Unsubscribe function
   */
  subscribe(type: AuthEventType, listener: AuthEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const typeListeners = this.listeners.get(type)!;
    typeListeners.add(listener);

    // Return unsubscribe function
    return () => {
      typeListeners.delete(listener);
    };
  }

  /**
   * Emit an auth event to all subscribers
   * @param event The auth event to emit
   */
  emit(event: AuthEvent): void {
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in auth event listener for ${event.type}:`, error);
          // Sentry.captureException(error, {
          //   data: { context: 'authEvents.emit', eventType: event.type },
          // });
        }
      });
    }
  }

  /**
   * Clear all listeners (useful for testing)
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for a specific event type (useful for debugging)
   */
  getListenerCount(type: AuthEventType): number {
    return this.listeners.get(type)?.size || 0;
  }
}

// Export singleton instance
export const authEvents = new AuthEventEmitter();

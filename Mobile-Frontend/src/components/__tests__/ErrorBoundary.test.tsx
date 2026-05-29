import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Reload must return a Promise — the production handler chains
// `.catch()` against it for the Expo-Go fallback path.
const mockReload = jest.fn<Promise<void>, []>();
jest.mock('expo-updates', () => ({
  reloadAsync: () => mockReload(),
}));

import ErrorBoundary from '../ErrorBoundary';

/**
 * Helper that throws once on first render so we can exercise the
 * boundary's fallback path. Wrapping in a component lets us avoid
 * polluting the test file's top-level scope with a throw.
 */
function Boom(): React.JSX.Element {
  throw new Error('render boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReload.mockResolvedValue(undefined);
    // React logs caught errors to console.error in dev. Silence it so the
    // test output stays clean — the boundary itself reports via Sentry.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>ok</Text>
      </ErrorBoundary>,
    );
    expect(getByText('ok')).toBeTruthy();
  });

  it('renders the fallback when a child throws on render', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(getByTestId('error-boundary-fallback')).toBeTruthy();
  });

  it('reports the caught error to Sentry', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [err] = mockCaptureException.mock.calls[0];
    expect((err as Error).message).toBe('render boom');
  });

  it('reload button calls Updates.reloadAsync', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.press(getByTestId('error-boundary-reload'));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('does not leak the raw error message to the fallback in production', () => {
    // Defense in depth: a thrown error like
    // `new Error("Failed to fetch user data for u-42 token=jwt...")`
    // should never appear verbatim in the user-facing fallback. The
    // boundary shows a generic message instead.
    const { queryByText } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(queryByText(/render boom/)).toBeNull();
  });
});

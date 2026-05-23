/**
 * Focused tests for CoopRoomScreen rendering. We mock `useCoopRoom` so the
 * WS layer doesn't try to connect, and feed the hook canned states to
 * verify each phase renders the expected user-visible surface.
 *
 * The primary regression this file guards against: the lobby phase MUST
 * render a real, scannable QR code (encoding a `coupro://` deep link
 * carrying the room code) — NOT a decorative placeholder grid. The
 * previous SpinnerScreen flow used a fake `QRPlaceholder` that no other
 * device could actually scan.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import CoopRoomScreen from '../CoopRoomScreen';
import type { CoopState } from '../coopReducer';
import { INITIAL_COOP_STATE } from '../coopReducer';

// ── Safe-area mock ───────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ── react-native-qrcode-svg mock ─────────────────────────────────────────────
// Render the QR as a stub View whose `data-qr-value` reflects what was
// encoded — tests assert the encoded value contains the room code.
jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, size }: { value: string; size?: number }) =>
      React.createElement(View, { testID: 'qr-code', accessibilityLabel: value, accessibilityValue: { text: value }, style: { width: size, height: size } }),
  };
});

// ── useCoopRoom mock with a controllable state ──────────────────────────────
const mockSetStake = jest.fn();
const mockCreateRoom = jest.fn();
const mockJoinRoom = jest.fn();
const mockReconnect = jest.fn();
let mockState: CoopState = INITIAL_COOP_STATE;
let mockStatus: 'closed' | 'connecting' | 'open' | 'closing' = 'open';

function mockCoop() {
  return {
    state: mockState,
    status: mockStatus,
    send: jest.fn(),
    close: jest.fn(),
    clearError: jest.fn(),
    createRoom: mockCreateRoom,
    joinRoom: mockJoinRoom,
    leaveRoom: jest.fn(),
    setStake: mockSetStake,
    lockStake: jest.fn(),
    unlockStake: jest.fn(),
    startCountdown: jest.fn(),
    pressIn: jest.fn(),
    pressOut: jest.fn(),
    ackReveal: jest.fn(),
    requestRematch: jest.fn(),
    reconnect: mockReconnect,
    active: true,
    activate: jest.fn(),
    deactivate: jest.fn(),
  };
}

// ── react-native-reanimated soft mock for animation children ────────────────
// CoopRoomScreen imports RevealAnimation which transitively uses Reanimated;
// the standard jest-expo preset already installs the mock but we add no-op
// fallbacks for the ChargeMeter / RevealAnimation children rendered above.
jest.mock('../ChargeMeter', () => 'ChargeMeter');
jest.mock('../RevealAnimation', () => 'RevealAnimation');

function makeState(overrides: Partial<CoopState>): CoopState {
  return { ...INITIAL_COOP_STATE, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = INITIAL_COOP_STATE;
  mockStatus = 'open';
});

describe('CoopRoomScreen — lobby invite UX', () => {
  it('shows the connect view (no QR) before a room is created', () => {
    mockState = makeState({ phase: null, code: null });
    const { queryByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    expect(queryByTestId('qr-code')).toBeNull();
    expect(queryByTestId('phase-connect')).toBeTruthy();
  });

  it('renders the room code as plain text in the lobby phase', () => {
    mockState = makeState({ phase: 'LOBBY_OPEN', code: 'ABC123', roomId: 'room-1' });
    const { getByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    expect(getByTestId('room-code').props.children).toBe('ABC123');
  });

  it('renders a real QR component in the lobby phase encoding a coupro:// deep link with the code', () => {
    mockState = makeState({ phase: 'LOBBY_OPEN', code: 'ABC123', roomId: 'room-1' });
    const { getByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    const qr = getByTestId('qr-code');
    // The QR must encode the actual room code so another device's scanner
    // can extract it. The exact format is a coupro:// deep link to make
    // the receiving app route directly into the join flow.
    expect(qr.props.accessibilityLabel).toContain('ABC123');
    expect(qr.props.accessibilityLabel).toMatch(/^coupro:\/\//);
  });

  it('does not render the QR for non-lobby phases', () => {
    mockState = makeState({ phase: 'STAKING', code: 'ABC123', roomId: 'room-1' });
    const { queryByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    expect(queryByTestId('qr-code')).toBeNull();
  });
});

describe('CoopRoomScreen — closed-status UX', () => {
  it('renders a Retry button on the connect view when status is closed', () => {
    mockState = makeState({ phase: null });
    mockStatus = 'closed';
    const { getByTestId, getByText } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    expect(getByTestId('btn-retry-connection')).toBeTruthy();
    getByText('重新連線');
  });

  it('tapping Retry calls reconnect()', () => {
    mockState = makeState({ phase: null });
    mockStatus = 'closed';
    const { getByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    getByTestId('btn-retry-connection').props.onClick?.();
    // RN Pressable uses onPress, not onClick — use fireEvent.
    const node = getByTestId('btn-retry-connection');
    // Pressable test rendering: node.props.onPress is the handler.
    node.props.onPress?.();
    expect(mockReconnect).toHaveBeenCalled();
  });

  it('disables createRoom + joinRoom buttons when status is connecting', () => {
    mockState = makeState({ phase: null });
    mockStatus = 'connecting';
    const { getByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    const solo = getByTestId('btn-solo');
    const multi = getByTestId('btn-multi');
    const disabledOf = (n: { props: { disabled?: boolean; accessibilityState?: { disabled?: boolean } } }) =>
      n.props.disabled || n.props.accessibilityState?.disabled;
    expect(disabledOf(solo)).toBe(true);
    expect(disabledOf(multi)).toBe(true);
  });

  it('disables createRoom + joinRoom buttons when status is closed', () => {
    mockState = makeState({ phase: null });
    mockStatus = 'closed';
    const { getByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    const solo = getByTestId('btn-solo');
    const multi = getByTestId('btn-multi');
    const disabledOf = (n: { props: { disabled?: boolean; accessibilityState?: { disabled?: boolean } } }) =>
      n.props.disabled || n.props.accessibilityState?.disabled;
    expect(disabledOf(solo)).toBe(true);
    expect(disabledOf(multi)).toBe(true);
  });

  it('does NOT render the Retry button while status is open', () => {
    mockState = makeState({ phase: null });
    mockStatus = 'open';
    const { queryByTestId } = render(
      <CoopRoomScreen coop={mockCoop()} onExit={jest.fn()} />,
    );
    expect(queryByTestId('btn-retry-connection')).toBeNull();
  });
});

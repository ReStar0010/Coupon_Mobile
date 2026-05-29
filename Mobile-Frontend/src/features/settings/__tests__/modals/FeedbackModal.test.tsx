import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import FeedbackModal from '../../modals/FeedbackModal';

const mockSubmitFeedback = jest.fn();

jest.mock('@/src/services/api/profile', () => ({
  submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
}));

const defaultProps = {
  visible: true,
  type: 'bug' as const,
  onClose: jest.fn(),
};

describe('FeedbackModal', () => {
  it('lifts the sheet body by the keyboard height when the keyboard opens', () => {
    // Keyboard.addListener-driven padding is platform-independent and
    // works inside Modal windows (where KeyboardAvoidingView with
    // adjustResize is unreliable). When the keyboard reports a height
    // of 320, the rendered keyboard-spacer should have paddingBottom
    // equal to that value so the textarea stays visible.
    const RN = jest.requireActual('react-native');
    const listeners: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    const removeShow = jest.fn();
    const removeHide = jest.fn();
    jest
      .spyOn(RN.Keyboard, 'addListener')
      .mockImplementation((...args: unknown[]) => {
        const event = args[0] as string;
        const cb = args[1] as (e: { endCoordinates: { height: number } }) => void;
        listeners[event] = cb;
        return { remove: event === 'keyboardDidShow' ? removeShow : removeHide };
      });

    const { getByTestId, unmount } = render(<FeedbackModal {...defaultProps} />);

    // Simulate keyboard appearing.
    act(() => {
      listeners.keyboardDidShow?.({ endCoordinates: { height: 320 } });
    });

    const spacer = getByTestId('feedback-keyboard-spacer');
    expect(spacer.props.style).toEqual(expect.objectContaining({ height: 320 }));

    // Unmounting must remove both listeners — no leaked native subscriptions.
    unmount();
    expect(removeShow).toHaveBeenCalled();
    expect(removeHide).toHaveBeenCalled();
  });

  it('collapses the spacer back to 0 when the keyboard hides', () => {
    const RN = jest.requireActual('react-native');
    const listeners: Record<string, (e?: { endCoordinates: { height: number } }) => void> = {};
    jest
      .spyOn(RN.Keyboard, 'addListener')
      .mockImplementation((...args: unknown[]) => {
        const event = args[0] as string;
        const cb = args[1] as (e?: { endCoordinates: { height: number } }) => void;
        listeners[event] = cb;
        return { remove: jest.fn() };
      });

    const { getByTestId } = render(<FeedbackModal {...defaultProps} />);
    act(() => {
      listeners.keyboardDidShow?.({ endCoordinates: { height: 280 } });
    });
    act(() => {
      listeners.keyboardDidHide?.();
    });
    expect(getByTestId('feedback-keyboard-spacer').props.style).toEqual(
      expect.objectContaining({ height: 0 }),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitFeedback.mockResolvedValue(undefined);
  });

  it('send button disabled when text empty', () => {
    const { getByTestId } = render(<FeedbackModal {...defaultProps} />);
    const btn = getByTestId('btn-send');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('send button enabled when text non-empty', () => {
    const { getByTestId } = render(<FeedbackModal {...defaultProps} />);
    fireEvent.changeText(getByTestId('feedback-input'), 'Test bug description');
    const btn = getByTestId('btn-send');
    expect(btn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('calls submitFeedback with type and trimmed text on send', async () => {
    const { getByTestId } = render(<FeedbackModal {...defaultProps} />);
    fireEvent.changeText(getByTestId('feedback-input'), '  Some bug  ');
    fireEvent.press(getByTestId('btn-send'));
    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith('bug', 'Some bug');
    });
  });

  it('passes feature type when type prop is "feature"', async () => {
    const { getByTestId } = render(
      <FeedbackModal {...defaultProps} type="feature" />,
    );
    fireEvent.changeText(getByTestId('feedback-input'), 'New idea');
    fireEvent.press(getByTestId('btn-send'));
    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith('feature', 'New idea');
    });
  });

  it('sent=true shows success state after successful submit', async () => {
    const { getByTestId, queryByTestId, findByTestId } = render(
      <FeedbackModal {...defaultProps} />,
    );
    fireEvent.changeText(getByTestId('feedback-input'), 'Some feedback');
    fireEvent.press(getByTestId('btn-send'));
    expect(await findByTestId('success-card')).toBeTruthy();
    expect(queryByTestId('feedback-input')).toBeNull();
  });

  it('shows the real support email (coupro707@gmail.com) on the send button and success card', async () => {
    // The backend routes feedback to settings.SUPPORT_EMAIL (default
    // coupro707@gmail.com). The UI used to lie to the user about where
    // their report went — anchor the displayed address to the real one.
    const { getByText, getByTestId, findByText } = render(<FeedbackModal {...defaultProps} />);
    expect(getByText(/coupro707@gmail\.com/)).toBeTruthy();

    fireEvent.changeText(getByTestId('feedback-input'), 'hi');
    fireEvent.press(getByTestId('btn-send'));
    expect(await findByText(/coupro707@gmail\.com/)).toBeTruthy();
  });

  it('shows inline error when submitFeedback fails', async () => {
    mockSubmitFeedback.mockRejectedValueOnce(new Error('Network error'));
    const { getByTestId, findByTestId, queryByTestId } = render(
      <FeedbackModal {...defaultProps} />,
    );
    fireEvent.changeText(getByTestId('feedback-input'), 'Some feedback');
    fireEvent.press(getByTestId('btn-send'));
    const errorEl = await findByTestId('feedback-error');
    expect(errorEl.props.children).toBe('Network error');
    // Success card should not be shown
    expect(queryByTestId('success-card')).toBeNull();
  });
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

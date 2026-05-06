import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FeedbackModal from '../../modals/FeedbackModal';

const defaultProps = {
  visible: true,
  type: 'bug' as const,
  onClose: jest.fn(),
};

describe('FeedbackModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('sent=true shows success state after pressing send', () => {
    const { getByTestId, queryByTestId } = render(
      <FeedbackModal {...defaultProps} />,
    );
    fireEvent.changeText(getByTestId('feedback-input'), 'Some feedback');
    fireEvent.press(getByTestId('btn-send'));
    expect(getByTestId('success-card')).toBeTruthy();
    expect(queryByTestId('feedback-input')).toBeNull();
  });
});

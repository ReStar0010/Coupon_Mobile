import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LegalTextModal from '../../modals/LegalTextModal';

const defaultProps = {
  visible: true,
  type: 'terms' as const,
  onClose: jest.fn(),
};

describe('LegalTextModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- terms variant ---

  it('renders terms title when type is "terms"', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    expect(getByText('服務條款')).toBeTruthy();
  });

  it('does not show content when visible is false', () => {
    const { queryByText } = render(
      <LegalTextModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('服務條款')).toBeNull();
  });

  it('shows terms body text', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    // The body contains this phrase — confirm it is present
    expect(getByText(/本服務條款/)).toBeTruthy();
  });

  it('shows age requirement text in terms body', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    expect(getByText(/您必須年滿 13 歲/)).toBeTruthy();
  });

  it('displays the close button', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    expect(getByText('關閉')).toBeTruthy();
  });

  it('pressing close button calls onClose', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    fireEvent.press(getByText('關閉'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // --- privacy variant ---

  it('renders privacy title when type is "privacy"', () => {
    const { getByText } = render(
      <LegalTextModal {...defaultProps} type="privacy" />,
    );
    expect(getByText('隱私政策')).toBeTruthy();
  });

  it('shows privacy body text', () => {
    const { getByText } = render(
      <LegalTextModal {...defaultProps} type="privacy" />,
    );
    expect(getByText(/本隱私政策說明/)).toBeTruthy();
  });

  it('shows data collection section in privacy body', () => {
    const { getByText } = render(
      <LegalTextModal {...defaultProps} type="privacy" />,
    );
    expect(getByText(/資料收集/)).toBeTruthy();
  });

  it('pressing close calls onClose for privacy type', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <LegalTextModal visible={true} type="privacy" onClose={onClose} />,
    );
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal is just displayed', () => {
    render(<LegalTextModal {...defaultProps} />);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LogoutConfirmModal from '../../modals/LogoutConfirmModal';

const defaultProps = {
  visible: true,
  onLogout: jest.fn(),
  onClose: jest.fn(),
};

describe('LogoutConfirmModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    const { getByTestId } = render(<LogoutConfirmModal {...defaultProps} />);
    expect(getByTestId('logout-modal')).toBeTruthy();
  });

  it('does not render sheet content when visible is false', () => {
    const { queryByTestId } = render(
      <LogoutConfirmModal {...defaultProps} visible={false} />,
    );
    expect(queryByTestId('logout-modal')).toBeNull();
  });

  it('displays the title text', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    expect(getByText('登出帳號')).toBeTruthy();
  });

  it('displays the confirmation subtitle text', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    expect(
      getByText('確定要登出嗎？下次登入還需要驗證身份。'),
    ).toBeTruthy();
  });

  it('displays cancel and confirm buttons', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    expect(getByText('取消')).toBeTruthy();
    expect(getByText('確定登出')).toBeTruthy();
  });

  it('pressing cancel calls onClose', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('取消'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing cancel does NOT call onLogout', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('取消'));
    expect(defaultProps.onLogout).not.toHaveBeenCalled();
  });

  it('pressing confirm calls onLogout', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('確定登出'));
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it('pressing confirm does NOT call onClose', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('確定登出'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('onLogout and onClose are independent callbacks', () => {
    const onLogout = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <LogoutConfirmModal visible={true} onLogout={onLogout} onClose={onClose} />,
    );
    fireEvent.press(getByText('確定登出'));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.press(getByText('取消'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1); // still only once
  });
});

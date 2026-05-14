import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LogoutConfirmModal from '../../modals/LogoutConfirmModal';

const mockLogout = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/src/state/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const defaultProps = {
  visible: true,
  onLogout: jest.fn(),
  onClose: jest.fn(),
};

describe('LogoutConfirmModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
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

  it('pressing cancel does NOT call logout or navigate', () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('取消'));
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(defaultProps.onLogout).not.toHaveBeenCalled();
  });

  it('pressing confirm calls logout from auth context', async () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('確定登出'));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  it('pressing confirm navigates to /(auth)/login', async () => {
    const { getByText } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('確定登出'));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('pressing confirm also calls onLogout prop after success', async () => {
    const onLogout = jest.fn();
    const { getByText } = render(
      <LogoutConfirmModal {...defaultProps} onLogout={onLogout} />,
    );
    fireEvent.press(getByText('確定登出'));
    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1);
    });
  });

  it('shows inline error when logout rejects', async () => {
    mockLogout.mockRejectedValueOnce(new Error('Network error'));
    const { getByText, findByTestId } = render(<LogoutConfirmModal {...defaultProps} />);
    fireEvent.press(getByText('確定登出'));
    const err = await findByTestId('logout-error');
    expect(err.props.children).toBe('Network error');
  });
});

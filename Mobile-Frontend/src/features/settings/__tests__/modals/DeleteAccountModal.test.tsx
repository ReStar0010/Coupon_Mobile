import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DeleteAccountModal from '../../modals/DeleteAccountModal';

const mockDeleteAccount = jest.fn();
const mockLogout = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/src/services/api/profile', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

jest.mock('@/src/state/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
};

describe('DeleteAccountModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAccount.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
  });

  it('initial state shows delete button', () => {
    const { getByTestId } = render(<DeleteAccountModal {...defaultProps} />);
    expect(getByTestId('btn-initial-delete')).toBeTruthy();
  });

  it('clicking delete button shows confirm step with password input', () => {
    const { getByTestId, queryByTestId } = render(
      <DeleteAccountModal {...defaultProps} />,
    );
    fireEvent.press(getByTestId('btn-initial-delete'));
    expect(getByTestId('confirm-warning-box')).toBeTruthy();
    expect(getByTestId('delete-password-input')).toBeTruthy();
    expect(queryByTestId('btn-initial-delete')).toBeNull();
  });

  it('blocks confirm and shows error when password is empty', () => {
    const { getByTestId } = render(<DeleteAccountModal {...defaultProps} />);
    fireEvent.press(getByTestId('btn-initial-delete'));
    fireEvent.press(getByTestId('btn-confirm-delete'));
    expect(getByTestId('delete-error')).toBeTruthy();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('calls deleteAccount with password and DATA_LOSS acknowledgment', async () => {
    const { getByTestId } = render(<DeleteAccountModal {...defaultProps} />);
    fireEvent.press(getByTestId('btn-initial-delete'));
    fireEvent.changeText(getByTestId('delete-password-input'), 'secret123');
    fireEvent.press(getByTestId('btn-confirm-delete'));
    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith('secret123', ['DATA_LOSS']);
    });
  });

  it('on success shows done state, calls logout, and navigates to login', async () => {
    const { getByTestId, findByTestId } = render(
      <DeleteAccountModal {...defaultProps} />,
    );
    fireEvent.press(getByTestId('btn-initial-delete'));
    fireEvent.changeText(getByTestId('delete-password-input'), 'secret123');
    fireEvent.press(getByTestId('btn-confirm-delete'));
    expect(await findByTestId('done-message')).toBeTruthy();
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('shows inline error when deleteAccount fails', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error('密碼錯誤'));
    const { getByTestId, findByTestId, queryByTestId } = render(
      <DeleteAccountModal {...defaultProps} />,
    );
    fireEvent.press(getByTestId('btn-initial-delete'));
    fireEvent.changeText(getByTestId('delete-password-input'), 'wrong');
    fireEvent.press(getByTestId('btn-confirm-delete'));
    const errorEl = await findByTestId('delete-error');
    expect(errorEl.props.children).toBe('密碼錯誤');
    expect(queryByTestId('done-message')).toBeNull();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

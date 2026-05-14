import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EditProfileModal from '../../modals/EditProfileModal';

const defaultProps = {
  visible: true,
  name: 'Test User',
  email: 'test@example.com',
  phone: '+886 912-345-678',
  onSave: jest.fn().mockResolvedValue(undefined),
  onClose: jest.fn(),
};

describe('EditProfileModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.onSave.mockResolvedValue(undefined);
  });

  it('renders when visible is true', () => {
    const { getByText } = render(<EditProfileModal {...defaultProps} />);
    expect(getByText('編輯個人資料')).toBeTruthy();
  });

  it('does not show content when visible is false', () => {
    const { queryByText } = render(
      <EditProfileModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('編輯個人資料')).toBeNull();
  });

  it('displays all three field labels', () => {
    const { getByText } = render(<EditProfileModal {...defaultProps} />);
    expect(getByText('顯示名稱')).toBeTruthy();
    expect(getByText('電子信箱')).toBeTruthy();
    expect(getByText('手機號碼')).toBeTruthy();
  });

  it('populates inputs with the provided initial values', () => {
    const { getAllByDisplayValue } = render(<EditProfileModal {...defaultProps} />);
    expect(getAllByDisplayValue('Test User').length).toBeGreaterThan(0);
    expect(getAllByDisplayValue('test@example.com').length).toBeGreaterThan(0);
    expect(getAllByDisplayValue('+886 912-345-678').length).toBeGreaterThan(0);
  });

  it('name input accepts text changes', () => {
    const { getAllByDisplayValue } = render(<EditProfileModal {...defaultProps} />);
    const nameInput = getAllByDisplayValue('Test User')[0];
    fireEvent.changeText(nameInput, 'New Name');
    expect(getAllByDisplayValue('New Name').length).toBeGreaterThan(0);
  });

  it('email input accepts text changes', () => {
    const { getAllByDisplayValue } = render(<EditProfileModal {...defaultProps} />);
    const emailInput = getAllByDisplayValue('test@example.com')[0];
    fireEvent.changeText(emailInput, 'new@email.com');
    expect(getAllByDisplayValue('new@email.com').length).toBeGreaterThan(0);
  });

  it('phone input accepts text changes', () => {
    const { getAllByDisplayValue } = render(<EditProfileModal {...defaultProps} />);
    const phoneInput = getAllByDisplayValue('+886 912-345-678')[0];
    fireEvent.changeText(phoneInput, '+886 900-000-000');
    expect(getAllByDisplayValue('+886 900-000-000').length).toBeGreaterThan(0);
  });

  it('pressing the save button calls onSave with current field values', async () => {
    const { getByText } = render(<EditProfileModal {...defaultProps} />);
    fireEvent.press(getByText('儲存'));
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        'Test User',
        'test@example.com',
        '+886 912-345-678',
      );
    });
  });

  it('pressing the save button also calls onClose after onSave resolves', async () => {
    const { getByText } = render(<EditProfileModal {...defaultProps} />);
    fireEvent.press(getByText('儲存'));
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('pressing save after editing passes updated values to onSave', async () => {
    const { getAllByDisplayValue, getByText } = render(
      <EditProfileModal {...defaultProps} />,
    );
    fireEvent.changeText(getAllByDisplayValue('Test User')[0], 'Edited Name');
    fireEvent.press(getByText('儲存'));
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        'Edited Name',
        'test@example.com',
        '+886 912-345-678',
      );
    });
  });

  it('shows inline error and does not close when onSave rejects', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('伺服器錯誤'));
    const onClose = jest.fn();
    const { getByText, findByTestId } = render(
      <EditProfileModal {...defaultProps} onSave={onSave} onClose={onClose} />,
    );
    fireEvent.press(getByText('儲存'));
    const errorEl = await findByTestId('edit-profile-error');
    expect(errorEl.props.children).toBe('伺服器錯誤');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders save button text', () => {
    const { getByText } = render(<EditProfileModal {...defaultProps} />);
    expect(getByText('儲存')).toBeTruthy();
  });
});

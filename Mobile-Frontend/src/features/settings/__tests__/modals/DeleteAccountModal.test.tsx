import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DeleteAccountModal from '../../modals/DeleteAccountModal';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
};

describe('DeleteAccountModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initial state shows delete button', () => {
    const { getByTestId } = render(<DeleteAccountModal {...defaultProps} />);
    expect(getByTestId('btn-initial-delete')).toBeTruthy();
  });

  it('clicking delete button shows confirm step', () => {
    const { getByTestId, queryByTestId } = render(
      <DeleteAccountModal {...defaultProps} />,
    );
    fireEvent.press(getByTestId('btn-initial-delete'));
    expect(getByTestId('confirm-warning-box')).toBeTruthy();
    expect(queryByTestId('btn-initial-delete')).toBeNull();
  });

  it('clicking confirm shows done state', () => {
    const { getByTestId, queryByTestId } = render(
      <DeleteAccountModal {...defaultProps} />,
    );
    fireEvent.press(getByTestId('btn-initial-delete'));
    fireEvent.press(getByTestId('btn-confirm-delete'));
    expect(getByTestId('done-message')).toBeTruthy();
    expect(queryByTestId('confirm-warning-box')).toBeNull();
  });
});

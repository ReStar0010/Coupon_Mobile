import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BlockedMerchantsModal from '../../modals/BlockedMerchantsModal';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
};

describe('BlockedMerchantsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    const { getByTestId } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(getByTestId('blocked-modal')).toBeTruthy();
  });

  it('does not show sheet when visible is false', () => {
    const { queryByTestId } = render(
      <BlockedMerchantsModal {...defaultProps} visible={false} />,
    );
    expect(queryByTestId('blocked-modal')).toBeNull();
  });

  it('renders the modal title', () => {
    const { getByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(getByText('封鎖商家')).toBeTruthy();
  });

  it('renders the subtitle description', () => {
    const { getByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(
      getByText('封鎖的商家不會出現在你的 CouMap 或優惠通知中。'),
    ).toBeTruthy();
  });

  it('displays the initial pre-seeded merchant list', () => {
    const { getByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(getByText('廣告商家 A')).toBeTruthy();
    expect(getByText('煩人推播店 B')).toBeTruthy();
  });

  it('shows two unblock buttons for the initial merchants', () => {
    const { getAllByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(getAllByText('解除').length).toBe(2);
  });

  it('pressing unblock removes the corresponding merchant', () => {
    const { getAllByText, queryByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    // Press unblock for the first merchant (廣告商家 A)
    fireEvent.press(getAllByText('解除')[0]);
    expect(queryByText('廣告商家 A')).toBeNull();
    expect(queryByText('煩人推播店 B')).toBeTruthy();
  });

  it('shows empty state message when all merchants are unblocked', () => {
    const { getAllByText, getByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    fireEvent.press(getAllByText('解除')[0]);
    fireEvent.press(getAllByText('解除')[0]);
    expect(getByText('尚未封鎖任何商家')).toBeTruthy();
  });

  it('adds a new merchant via the text input and + button', () => {
    const { getByPlaceholderText, getByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('輸入商家名稱…');
    fireEvent.changeText(input, '新商家 C');
    fireEvent.press(getByText('+'));
    expect(getByText('新商家 C')).toBeTruthy();
  });

  it('clears the input after adding a merchant', () => {
    const { getByPlaceholderText, getByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('輸入商家名稱…');
    fireEvent.changeText(input, '新商家 D');
    fireEvent.press(getByText('+'));
    expect(input.props.value).toBe('');
  });

  it('does not add a merchant when input is empty', () => {
    const { getAllByText, getByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    fireEvent.press(getByText('+'));
    // Still only the two original unblock buttons
    expect(getAllByText('解除').length).toBe(2);
  });

  it('does not add a merchant when input contains only whitespace', () => {
    const { getAllByText, getByPlaceholderText, getByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    fireEvent.changeText(getByPlaceholderText('輸入商家名稱…'), '   ');
    fireEvent.press(getByText('+'));
    expect(getAllByText('解除').length).toBe(2);
  });

  it('pressing the done button calls onClose', () => {
    const { getByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    fireEvent.press(getByText('完成'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('onClose is not called on initial render', () => {
    render(<BlockedMerchantsModal {...defaultProps} />);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});

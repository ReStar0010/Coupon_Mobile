import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import VerifyModal from '../../modals/VerifyModal';

const defaultEmailProps = {
  visible: true,
  field: 'email' as const,
  currentVal: 'test@example.com',
  onClose: jest.fn(),
};

const defaultPhoneProps = {
  visible: true,
  field: 'phone' as const,
  currentVal: '+886 912-345-678',
  onClose: jest.fn(),
};

describe('VerifyModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Initial render / input step ---

  it('renders when visible is true', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    expect(getByText('驗證電子信箱')).toBeTruthy();
  });

  it('does not show content when visible is false', () => {
    const { queryByText } = render(
      <VerifyModal {...defaultEmailProps} visible={false} />,
    );
    expect(queryByText('驗證電子信箱')).toBeNull();
  });

  it('shows email title for field="email"', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    expect(getByText('驗證電子信箱')).toBeTruthy();
  });

  it('shows phone title for field="phone"', () => {
    const { getByText } = render(<VerifyModal {...defaultPhoneProps} />);
    expect(getByText('驗證手機號碼')).toBeTruthy();
  });

  it('displays the current value on the input step', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('shows the send-code button on the input step', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    expect(getByText('發送驗證碼')).toBeTruthy();
  });

  it('shows the close button on the input step', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    expect(getByText('關閉')).toBeTruthy();
  });

  it('shows "(尚未設定)" when currentVal is empty', () => {
    const { getByText } = render(
      <VerifyModal
        visible={true}
        field="email"
        currentVal=""
        onClose={jest.fn()}
      />,
    );
    expect(getByText('（尚未設定）')).toBeTruthy();
  });

  // --- Transition from input step to code step ---

  it('pressing send-code when currentVal is set advances to code step', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    fireEvent.press(getByText('發送驗證碼'));
    expect(getByText('確認驗證')).toBeTruthy();
  });

  it('pressing send-code when currentVal is empty stays on input step', () => {
    const { getByText, queryByText } = render(
      <VerifyModal
        visible={true}
        field="email"
        currentVal=""
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    // Should remain on input step
    expect(queryByText('確認驗證')).toBeNull();
    expect(getByText('發送驗證碼')).toBeTruthy();
  });

  // --- Code step ---

  it('shows the OTP input on the code step', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    expect(getByPlaceholderText('輸入 6 位數驗證碼')).toBeTruthy();
  });

  it('confirm button is disabled (grey) before 6 digits entered', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    // Enter fewer than 6 digits
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '123');
    fireEvent.press(getByText('確認驗證'));
    // Should still be on the code step — done message must not appear
    expect(getByText('確認驗證')).toBeTruthy();
  });

  it('entering 6 digits and pressing confirm advances to done step', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '123456');
    fireEvent.press(getByText('確認驗證'));
    expect(getByText('電子信箱驗證成功！')).toBeTruthy();
  });

  it('done step shows success checkmark character', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '654321');
    fireEvent.press(getByText('確認驗證'));
    expect(getByText('✓')).toBeTruthy();
  });

  it('done step shows correct label for phone field', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultPhoneProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '111222');
    fireEvent.press(getByText('確認驗證'));
    expect(getByText('手機號碼驗證成功！')).toBeTruthy();
  });

  // --- OTP digit stripping ---

  it('strips non-numeric characters from the OTP input', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    const input = getByPlaceholderText('輸入 6 位數驗證碼');
    fireEvent.changeText(input, 'abc123def');
    // After stripping non-digits: '123' — still on code step, not done
    expect(getByText('確認驗證')).toBeTruthy();
  });

  it('truncates OTP to 6 digits maximum', () => {
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    const input = getByPlaceholderText('輸入 6 位數驗證碼');
    fireEvent.changeText(input, '12345678');
    fireEvent.press(getByText('確認驗證'));
    // 8 digits truncated to 6 — confirm button was active and we hit done
    expect(getByText('電子信箱驗證成功！')).toBeTruthy();
  });

  // --- Close button behaviour ---

  it('pressing close on the input step calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <VerifyModal {...defaultEmailProps} onClose={onClose} />,
    );
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing close on the code step calls onClose', () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} onClose={onClose} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    expect(getByPlaceholderText('輸入 6 位數驗證碼')).toBeTruthy();
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing close on the done step calls onClose', () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <VerifyModal {...defaultEmailProps} onClose={onClose} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '999888');
    fireEvent.press(getByText('確認驗證'));
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('onClose is not called on initial render', () => {
    render(<VerifyModal {...defaultEmailProps} />);
    expect(defaultEmailProps.onClose).not.toHaveBeenCalled();
  });
});

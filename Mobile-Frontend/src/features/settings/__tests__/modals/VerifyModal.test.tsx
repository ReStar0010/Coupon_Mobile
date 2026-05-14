import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VerifyModal from '../../modals/VerifyModal';

const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockRequestEmailVerification = jest.fn();
const mockRefreshAuth = jest.fn();

jest.mock('@/src/services/api/auth', () => ({
  requestOtp: (...args: unknown[]) => mockRequestOtp(...args),
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  requestEmailVerification: (...args: unknown[]) => mockRequestEmailVerification(...args),
}));

jest.mock('@/src/state/AuthContext', () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));

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
    mockRequestOtp.mockResolvedValue({ detail: 'sent' });
    mockVerifyOtp.mockResolvedValue({ access: 'a', refresh: 'r', user: {} });
    mockRequestEmailVerification.mockResolvedValue({ detail: 'sent' });
    mockRefreshAuth.mockResolvedValue(undefined);
  });

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

  it('shows phone title for field="phone"', () => {
    const { getByText } = render(<VerifyModal {...defaultPhoneProps} />);
    expect(getByText('驗證手機號碼')).toBeTruthy();
  });

  it('displays the current value on the input step', () => {
    const { getByText } = render(<VerifyModal {...defaultEmailProps} />);
    expect(getByText('test@example.com')).toBeTruthy();
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

  // --- Phone flow ---

  it('phone send-code calls requestOtp and advances to code step', async () => {
    const { getByText, findByText } = render(<VerifyModal {...defaultPhoneProps} />);
    fireEvent.press(getByText('發送驗證碼'));
    await waitFor(() => {
      expect(mockRequestOtp).toHaveBeenCalledWith('+886 912-345-678');
    });
    expect(await findByText('確認驗證')).toBeTruthy();
  });

  it('phone send-code surfaces error from requestOtp', async () => {
    mockRequestOtp.mockRejectedValueOnce(new Error('SMS 發送失敗'));
    const { getByText, findByTestId } = render(<VerifyModal {...defaultPhoneProps} />);
    fireEvent.press(getByText('發送驗證碼'));
    const err = await findByTestId('verify-error');
    expect(err.props.children).toBe('SMS 發送失敗');
  });

  it('phone verify calls verifyOtp and refreshAuth on success', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(
      <VerifyModal {...defaultPhoneProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    await findByText('確認驗證');
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '123456');
    fireEvent.press(getByText('確認驗證'));
    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith('+886 912-345-678', '123456');
    });
    await waitFor(() => {
      expect(mockRefreshAuth).toHaveBeenCalled();
    });
    expect(await findByText('手機號碼驗證成功！')).toBeTruthy();
  });

  it('phone verify surfaces error from verifyOtp', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('驗證碼錯誤'));
    const { getByText, getByPlaceholderText, findByText, findByTestId } = render(
      <VerifyModal {...defaultPhoneProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    await findByText('確認驗證');
    fireEvent.changeText(getByPlaceholderText('輸入 6 位數驗證碼'), '000000');
    fireEvent.press(getByText('確認驗證'));
    const err = await findByTestId('verify-error');
    expect(err.props.children).toBe('驗證碼錯誤');
  });

  it('pressing send-code when currentVal is empty stays on input step and does not call api', () => {
    const { getByText, queryByText } = render(
      <VerifyModal
        visible={true}
        field="phone"
        currentVal=""
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    expect(mockRequestOtp).not.toHaveBeenCalled();
    expect(queryByText('確認驗證')).toBeNull();
  });

  it('strips non-numeric characters from the OTP input', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(
      <VerifyModal {...defaultPhoneProps} />,
    );
    fireEvent.press(getByText('發送驗證碼'));
    await findByText('確認驗證');
    const input = getByPlaceholderText('輸入 6 位數驗證碼');
    fireEvent.changeText(input, 'abc123def');
    // Still on code step
    expect(getByText('確認驗證')).toBeTruthy();
  });

  // --- Email flow ---

  it('email send calls requestEmailVerification and shows guidance message', async () => {
    const { getByText, findByText } = render(<VerifyModal {...defaultEmailProps} />);
    fireEvent.press(getByText('發送驗證碼'));
    await waitFor(() => {
      expect(mockRequestEmailVerification).toHaveBeenCalledWith('test@example.com');
    });
    expect(await findByText('請點擊郵件中的連結')).toBeTruthy();
  });

  it('email send surfaces error from requestEmailVerification', async () => {
    mockRequestEmailVerification.mockRejectedValueOnce(new Error('郵件發送失敗'));
    const { getByText, findByTestId } = render(<VerifyModal {...defaultEmailProps} />);
    fireEvent.press(getByText('發送驗證碼'));
    const err = await findByTestId('verify-error');
    expect(err.props.children).toBe('郵件發送失敗');
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
});

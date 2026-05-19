import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
let mockSearchParams: { token?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockSearchParams,
}));

const mockAcceptShare = jest.fn();
jest.mock('@/src/services/api/sharing', () => ({
  acceptShare: (...args: unknown[]) => mockAcceptShare(...args),
}));

let mockAuth: { isAuthenticated: boolean; isLoading: boolean } = {
  isAuthenticated: true,
  isLoading: false,
};
jest.mock('@/src/state/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/src/services/analytics/posthog', () => ({
  track: jest.fn(),
}));

import CollectionTokenRoute from '../[token]';

describe('CollectionTokenRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = { token: 'abc' };
    mockAuth = { isAuthenticated: true, isLoading: false };
  });

  it('renders the success state after the BE accepts the share', async () => {
    mockAcceptShare.mockResolvedValueOnce({
      message: 'ok',
      coupon_id: 7,
      coupon_name: '阿明早餐券',
      acquisition_method: 'public_pool',
    });
    const { findByText, getByTestId } = render(<CollectionTokenRoute />);
    expect(await findByText('已領取！')).toBeTruthy();
    expect(await findByText('阿明早餐券')).toBeTruthy();
    expect(getByTestId('claim-go-home')).toBeTruthy();
    expect(mockAcceptShare).toHaveBeenCalledWith('abc');
  });

  it('renders an error state when accept fails (e.g. already claimed)', async () => {
    mockAcceptShare.mockRejectedValueOnce(new Error('這張優惠券已被別人領走'));
    const { findByTestId } = render(<CollectionTokenRoute />);
    const err = await findByTestId('claim-error');
    expect(err.props.children).toBe('這張優惠券已被別人領走');
  });

  it('does NOT call acceptShare when not authenticated — bounces to login instead', async () => {
    mockAuth = { isAuthenticated: false, isLoading: false };
    render(<CollectionTokenRoute />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
    expect(mockAcceptShare).not.toHaveBeenCalled();
  });

  it('shows an error state when token query param is missing', async () => {
    mockSearchParams = {};
    const { findByTestId } = render(<CollectionTokenRoute />);
    const err = await findByTestId('claim-error');
    expect(err.props.children).toMatch(/無效|過期/);
    expect(mockAcceptShare).not.toHaveBeenCalled();
  });
});

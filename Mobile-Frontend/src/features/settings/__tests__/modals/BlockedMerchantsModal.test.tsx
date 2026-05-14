import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BlockedMerchantsModal from '../../modals/BlockedMerchantsModal';

const mockGetBlocked = jest.fn();
const mockUnblock = jest.fn();

jest.mock('@/src/services/api/merchants', () => ({
  getBlockedMerchants: () => mockGetBlocked(),
  unblockMerchant: (id: string) => mockUnblock(id),
}));

const fakeMerchants = [
  {
    id: 'm1',
    name: '廣告商家 A',
    category: 'food',
    lat: 0,
    lng: 0,
    address: '',
    verified: true,
    logoUrl: null,
  },
  {
    id: 'm2',
    name: '煩人推播店 B',
    category: 'retail',
    lat: 0,
    lng: 0,
    address: '',
    verified: true,
    logoUrl: null,
  },
];

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
};

describe('BlockedMerchantsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBlocked.mockResolvedValue(fakeMerchants);
    mockUnblock.mockResolvedValue(undefined);
  });

  async function flush(): Promise<void> {
    // Allow the pending fetch promise to resolve and React to commit updates.
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('renders when visible is true', async () => {
    const { getByTestId } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(getByTestId('blocked-modal')).toBeTruthy();
    await flush();
  });

  it('does not show sheet when visible is false', () => {
    const { queryByTestId } = render(
      <BlockedMerchantsModal {...defaultProps} visible={false} />,
    );
    expect(queryByTestId('blocked-modal')).toBeNull();
  });

  it('renders the modal title', async () => {
    const { getByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(getByText('封鎖商家')).toBeTruthy();
    await flush();
  });

  it('renders the subtitle description', async () => {
    const { getByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(
      getByText('封鎖的商家不會出現在你的 CouMap 或優惠通知中。'),
    ).toBeTruthy();
    await flush();
  });

  it('fetches the blocked merchant list when opened', async () => {
    render(<BlockedMerchantsModal {...defaultProps} />);
    await waitFor(() => {
      expect(mockGetBlocked).toHaveBeenCalled();
    });
  });

  it('displays the fetched blocked merchant list', async () => {
    const { findByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(await findByText('廣告商家 A')).toBeTruthy();
    expect(await findByText('煩人推播店 B')).toBeTruthy();
  });

  it('pressing unblock calls the API and removes the merchant', async () => {
    const { findByTestId, queryByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    const btn = await findByTestId('btn-unblock-m1');
    fireEvent.press(btn);
    await waitFor(() => {
      expect(mockUnblock).toHaveBeenCalledWith('m1');
    });
    await waitFor(() => {
      expect(queryByText('廣告商家 A')).toBeNull();
    });
  });

  it('shows empty state when API returns no merchants', async () => {
    mockGetBlocked.mockResolvedValueOnce([]);
    const { findByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    expect(await findByText('尚未封鎖任何商家')).toBeTruthy();
  });

  it('shows error message when fetch fails', async () => {
    mockGetBlocked.mockRejectedValueOnce(new Error('Server error'));
    const { findByTestId } = render(<BlockedMerchantsModal {...defaultProps} />);
    const err = await findByTestId('blocked-error');
    expect(err.props.children).toBe('Server error');
  });

  it('restores merchant when unblock fails', async () => {
    mockUnblock.mockRejectedValueOnce(new Error('解除失敗'));
    const { findByTestId, findByText, queryByText } = render(
      <BlockedMerchantsModal {...defaultProps} />,
    );
    const btn = await findByTestId('btn-unblock-m1');
    fireEvent.press(btn);
    // Optimistic removal
    await waitFor(() => {
      expect(queryByText('廣告商家 A')).toBeNull();
    });
    // Restoration after failure
    expect(await findByText('廣告商家 A')).toBeTruthy();
  });

  it('pressing the done button calls onClose', async () => {
    const { findByText } = render(<BlockedMerchantsModal {...defaultProps} />);
    const doneBtn = await findByText('完成');
    fireEvent.press(doneBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('onClose is not called on initial render', () => {
    render(<BlockedMerchantsModal {...defaultProps} />);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});

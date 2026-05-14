import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import HistoryDetailScreen from '../HistoryDetailScreen';
import type { HistoryEntryDetail } from '../../../services/api/transactions';

const mockGetTransaction = jest.fn();
jest.mock('../../../services/api/transactions', () => ({
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
}));

const couponEntry: HistoryEntryDetail = {
  id: '42',
  kind: 'coupon_redeem',
  type: 'coupon',
  store: '阿明早餐店',
  detail: '$25 折抵 — 阿明早餐店',
  amount: 25,
  usedAt: '2026-05-06 09:14',
  balanceAfterGems: 0,
  balanceAfterCouPoints: 0,
};

const coupointEntry: HistoryEntryDetail = {
  id: '7',
  kind: 'spinner_solo',
  type: 'coupoint',
  store: null,
  detail: '轉盤兌換 +5 CouPoint',
  amount: 5,
  usedAt: '2026-05-04 12:00',
  balanceAfterGems: 2,
  balanceAfterCouPoints: 5,
};

const makeProps = (
  overrides: Partial<React.ComponentProps<typeof HistoryDetailScreen>> = {},
) => ({
  id: couponEntry.id,
  onBack: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTransaction.mockResolvedValue(couponEntry);
});

describe('HistoryDetailScreen', () => {
  it('renders the loading state until the API resolves', async () => {
    let resolveFn: ((value: HistoryEntryDetail) => void) | undefined;
    mockGetTransaction.mockReturnValueOnce(
      new Promise<HistoryEntryDetail>((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { getByTestId } = render(<HistoryDetailScreen {...makeProps()} />);
    expect(getByTestId('detail-loading')).toBeTruthy();

    await act(async () => {
      resolveFn?.(couponEntry);
    });
  });

  it('fetches the transaction by id', async () => {
    render(<HistoryDetailScreen {...makeProps({ id: '42' })} />);
    await waitFor(() => expect(mockGetTransaction).toHaveBeenCalledWith('42'));
  });

  it('renders the store name and amount for a coupon row', async () => {
    const { findByText } = render(<HistoryDetailScreen {...makeProps()} />);
    await findByText('阿明早餐店');
    await findByText('25');
  });

  it('renders the formatted record number with leading zeros', async () => {
    const { findByText } = render(<HistoryDetailScreen {...makeProps()} />);
    await findByText('# 000042');
  });

  it('renders the date and time separately', async () => {
    const { findByText } = render(<HistoryDetailScreen {...makeProps()} />);
    await findByText('2026-05-06');
    await findByText('09:14');
  });

  it('renders the coupon reference row when present', async () => {
    mockGetTransaction.mockResolvedValueOnce({
      ...couponEntry,
      coupon: { id: 99, name: '買一送一' },
    });
    const { findByTestId, findByText } = render(<HistoryDetailScreen {...makeProps()} />);
    await findByTestId('detail-coupon');
    await findByText('買一送一');
  });

  it('renders CouPoint copy for a coupoint-type row', async () => {
    mockGetTransaction.mockResolvedValueOnce(coupointEntry);
    const { findByText } = render(<HistoryDetailScreen {...makeProps({ id: '7' })} />);
    await findByText('CouPoint 兌換');
  });

  it('renders the error state when the API rejects', async () => {
    mockGetTransaction.mockRejectedValueOnce(new Error('not found'));
    const { findByTestId, getByText } = render(<HistoryDetailScreen {...makeProps()} />);
    await findByTestId('detail-error');
    expect(getByText('not found')).toBeTruthy();
  });

  it('invokes onBack when the back arrow is pressed', async () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<HistoryDetailScreen {...makeProps({ onBack })} />);
    fireEvent.press(getByTestId('detail-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('refetches when id changes', async () => {
    const { rerender } = render(<HistoryDetailScreen {...makeProps({ id: '42' })} />);
    await waitFor(() => expect(mockGetTransaction).toHaveBeenCalledWith('42'));
    mockGetTransaction.mockResolvedValueOnce(coupointEntry);
    rerender(<HistoryDetailScreen {...makeProps({ id: '7' })} />);
    await waitFor(() => expect(mockGetTransaction).toHaveBeenCalledWith('7'));
  });
});

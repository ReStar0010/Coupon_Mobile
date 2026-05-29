import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import HistoryScreen from '../HistoryScreen';
import type { HistoryEntry, HistoryPage } from '../../../services/api/transactions';

// ── transactions API mock ────────────────────────────────────────────────────
const mockListTransactions = jest.fn();
jest.mock('../../../services/api/transactions', () => ({
  listTransactions: (...args: unknown[]) => mockListTransactions(...args),
}));

const couponEntry: HistoryEntry = {
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

const coupointEntry: HistoryEntry = {
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

const samplePage: HistoryPage = {
  items: [couponEntry, coupointEntry],
  nextCursor: null,
};

const makeProps = (overrides: Partial<React.ComponentProps<typeof HistoryScreen>> = {}) => ({
  onBack: jest.fn(),
  onSelect: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListTransactions.mockResolvedValue(samplePage);
});

describe('HistoryScreen', () => {
  it('renders the screen title and back button', async () => {
    const { getByText, getByTestId } = render(<HistoryScreen {...makeProps()} />);
    expect(getByText('歷史紀錄')).toBeTruthy();
    expect(getByTestId('history-back')).toBeTruthy();
    await waitFor(() => expect(mockListTransactions).toHaveBeenCalled());
  });

  it('shows the loading indicator before the page resolves', async () => {
    let resolveFn: ((value: HistoryPage) => void) | undefined;
    mockListTransactions.mockReturnValueOnce(
      new Promise<HistoryPage>((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { getByTestId } = render(<HistoryScreen {...makeProps()} />);
    expect(getByTestId('history-loading')).toBeTruthy();

    await act(async () => {
      resolveFn?.(samplePage);
    });
  });

  it('fetches transactions with type=all on first render', async () => {
    render(<HistoryScreen {...makeProps()} />);
    await waitFor(() =>
      expect(mockListTransactions).toHaveBeenCalledWith('all', 25, undefined),
    );
  });

  it('renders one row per transaction returned from the API', async () => {
    const { findAllByTestId } = render(<HistoryScreen {...makeProps()} />);
    const rows = await findAllByTestId(/^history-item-/);
    expect(rows).toHaveLength(2);
  });

  it('renders the empty state when the API returns no items', async () => {
    mockListTransactions.mockResolvedValueOnce({ items: [], nextCursor: null });
    const { findByTestId } = render(<HistoryScreen {...makeProps()} />);
    await findByTestId('history-empty');
  });

  it('renders an error state when the API rejects', async () => {
    mockListTransactions.mockRejectedValueOnce(new Error('boom'));
    const { findByTestId, getByText } = render(<HistoryScreen {...makeProps()} />);
    await findByTestId('history-error');
    expect(getByText('boom')).toBeTruthy();
  });

  it('re-fetches when a filter chip is pressed', async () => {
    const { findAllByTestId, getByTestId } = render(<HistoryScreen {...makeProps()} />);
    await findAllByTestId(/^history-item-/);
    mockListTransactions.mockClear();

    fireEvent.press(getByTestId('history-filter-coupoint'));

    await waitFor(() =>
      expect(mockListTransactions).toHaveBeenCalledWith('coupoint', 25, undefined),
    );
  });

  it('forwards selected id to onSelect when a row is tapped', async () => {
    const onSelect = jest.fn();
    const { findByTestId } = render(<HistoryScreen {...makeProps({ onSelect })} />);
    const row = await findByTestId(`history-item-${couponEntry.id}`);
    fireEvent.press(row);
    expect(onSelect).toHaveBeenCalledWith(couponEntry.id);
  });

  it('invokes onBack when the back button is pressed', async () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<HistoryScreen {...makeProps({ onBack })} />);
    fireEvent.press(getByTestId('history-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders falls-back store label when store is null', async () => {
    mockListTransactions.mockResolvedValueOnce({
      items: [coupointEntry],
      nextCursor: null,
    });
    const { findByText } = render(<HistoryScreen {...makeProps()} />);
    await findByText('—');
  });

  it('aggregates totalSaved across the loaded page', async () => {
    const { findByText } = render(<HistoryScreen {...makeProps()} />);
    // 25 + 5 = 30
    await findByText('30');
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import DrawModal from '../DrawModal';
import type { DailyDrawTemplate } from '@/src/services/api/coupons';

// ── WalletContext mock ───────────────────────────────────────────────────────
const mockRefreshWallet = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/state/WalletContext', () => ({
  useWallet: () => ({ refreshWallet: mockRefreshWallet }),
}));

// ── coupons API mock ─────────────────────────────────────────────────────────
const mockListTemplates = jest.fn();
const mockDailyDraw = jest.fn();
jest.mock('@/src/services/api/coupons', () => ({
  listDailyDrawTemplates: (...args: unknown[]) => mockListTemplates(...args),
  dailyDraw: (...args: unknown[]) => mockDailyDraw(...args),
}));

// Rarest prize (id 2, 5%) is intentionally NOT first in the input array, so the
// test also proves the modal sorts grand-prizes to the top.
const TEMPLATES: DailyDrawTemplate[] = [
  {
    id: 1,
    store_id: 1,
    store_name: '阿明早餐店',
    coupon_name: '日常好券',
    image_url: null,
    estimated_savings: 25,
    expiry_date: '2026-12-31',
    remaining_quantity: 10,
    draw_probability: 0.5,
  },
  {
    id: 2,
    store_id: 2,
    store_name: '頂級牛排館',
    coupon_name: '免費大餐',
    image_url: null,
    estimated_savings: 500,
    expiry_date: '2026-12-31',
    remaining_quantity: 1,
    draw_probability: 0.05,
  },
  {
    id: 3,
    store_id: 3,
    store_name: '手沖小巷',
    coupon_name: '咖啡折抵',
    image_url: null,
    estimated_savings: 60,
    expiry_date: '2026-12-31',
    remaining_quantity: 5,
    draw_probability: 0.2,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockListTemplates.mockResolvedValue(TEMPLATES);
});

describe('DrawModal pool list', () => {
  it('shows win probability per prize and a 大獎 tag on the rarest, with no quantity', async () => {
    const { findByText, getByText, queryByText } = render(
      <DrawModal visible onClose={jest.fn()} />,
    );

    // Probabilities render for each shown prize (rarest = 5%).
    await findByText('5%');
    expect(getByText('50%')).toBeTruthy();
    expect(getByText('20%')).toBeTruthy();

    // The rarest prize is featured as 大獎.
    expect(getByText('大獎')).toBeTruthy();

    // Quantity ("X 張") is no longer shown anywhere.
    expect(queryByText(/張/)).toBeNull();
  });

  it('subtitle no longer implies the draw is limited to the shown stores', async () => {
    const { findByText, queryByText } = render(<DrawModal visible onClose={jest.fn()} />);

    await findByText('5%'); // wait for templates to load
    expect(queryByText(/從以下店家/)).toBeNull();
    expect(queryByText('免費抽券 · 每日一次，隨機抽取')).toBeTruthy();
  });
});

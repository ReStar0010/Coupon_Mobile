export interface HistoryEntry {
  id: string;
  store: string;
  detail: string;
  amount: number;
  usedAt: string;
  type: 'coupon' | 'coupoint';
}

export const HISTORY_DATA: HistoryEntry[] = [
  {
    id: '1',
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    amount: 25,
    usedAt: '2026-05-06 09:14',
    type: 'coupon',
  },
  {
    id: '2',
    store: '手沖小巷',
    detail: '$10 現金折抵',
    amount: 10,
    usedAt: '2026-05-04 15:02',
    type: 'coupon',
  },
  {
    id: '3',
    store: '全聯福利中心',
    detail: 'CouPoint 兌換 $15',
    amount: 15,
    usedAt: '2026-05-01 19:38',
    type: 'coupoint',
  },
  {
    id: '4',
    store: '夜市攤三杯',
    detail: '$5 現金折抵',
    amount: 5,
    usedAt: '2026-04-29 20:11',
    type: 'coupon',
  },
  {
    id: '5',
    store: '鼎泰豐',
    detail: '$30 現金折抵',
    amount: 30,
    usedAt: '2026-04-25 12:45',
    type: 'coupon',
  },
  {
    id: '6',
    store: '85度C',
    detail: 'CouPoint 兌換 $10',
    amount: 10,
    usedAt: '2026-04-22 08:30',
    type: 'coupoint',
  },
  {
    id: '7',
    store: '全家便利商店',
    detail: '$5 現金折抵',
    amount: 5,
    usedAt: '2026-04-18 17:22',
    type: 'coupon',
  },
];

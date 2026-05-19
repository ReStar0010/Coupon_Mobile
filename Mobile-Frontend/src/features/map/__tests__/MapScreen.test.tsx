import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import type { Merchant, MerchantDetail } from '@/src/services/api/merchants';
import MapScreen from '../MapScreen';

// ── safe-area mock ──────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ── expo-location mock — used by the bottom-right locate button ────────────
const mockRequestPermission = jest.fn();
const mockGetPermission = jest.fn();
const mockGetCurrentPosition = jest.fn();
const mockWatchHeading = jest.fn();
const mockWatchPosition = jest.fn();
const mockHeadingRemove = jest.fn();
const mockPositionRemove = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestPermission(),
  getForegroundPermissionsAsync: () => mockGetPermission(),
  getCurrentPositionAsync: (opts: unknown) => mockGetCurrentPosition(opts),
  watchHeadingAsync: (cb: (h: { trueHeading: number; magHeading: number }) => void) =>
    mockWatchHeading(cb),
  watchPositionAsync: (
    opts: unknown,
    cb: (p: { coords: { latitude: number; longitude: number } }) => void,
  ) => mockWatchPosition(opts, cb),
  Accuracy: { Balanced: 3, High: 4, Highest: 6 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
}));

// ── merchants service mock ──────────────────────────────────────────────────
// Module under test fetches `listNearby` on mount and `getMerchant` on pin tap.
// The fixtures mirror the previous hard-coded SAMPLE_MERCHANTS so existing
// assertions (4 active pins, '阿明早餐店' at lat=25.0478, etc.) keep passing.
const FIXTURE_MERCHANTS: Merchant[] = [
  { id: '1', name: '阿明早餐店', category: 'food', lat: 25.0478, lng: 121.5318, address: '忠孝東路 3 段', verified: true, logoUrl: null },
  { id: '2', name: '鼎泰豐', category: 'food', lat: 25.0490, lng: 121.5340, address: '信義路 2 段', verified: true, logoUrl: null },
  { id: '3', name: '85度C', category: 'cafe', lat: 25.0460, lng: 121.5302, address: '復興南路 1 段', verified: false, logoUrl: null },
  { id: '6', name: '全家', category: 'convenience', lat: 25.0468, lng: 121.5375, address: '中山北路 2 段', verified: true, logoUrl: null },
];

const FIXTURE_DETAILS: Record<string, MerchantDetail> = {
  '1': {
    id: '1', name: '阿明早餐店', category: 'food', lat: 25.0478, lng: 121.5318,
    address: '忠孝東路 3 段', verified: true, logoUrl: null,
    myCoupons: [
      { id: 'mc1-1', label: '折抵', detail: '$25 現金折抵', expires: '11/08', amount: 25 },
      { id: 'mc1-2', label: '買一送一', detail: '美式咖啡', expires: '11/15', amount: 0 },
    ],
    sharedCoupons: [
      { store: '阿明早餐店', amount: 5, sharer: '小明', msg: '大家來吃看看', label: '折抵' },
    ],
    news: [{ id: 1, author: '阿明早餐店', agoText: '2 小時前', body: '今天有新品', createdAt: '2026-05-14' }],
  },
  '2': {
    id: '2', name: '鼎泰豐', category: 'food', lat: 25.0490, lng: 121.5340,
    address: '信義路 2 段', verified: true, logoUrl: null,
    myCoupons: [
      { id: 'mc2-1', label: '折抵', detail: '$50 現金折抵', expires: '12/01', amount: 50 },
    ],
    sharedCoupons: [
      { store: '鼎泰豐', amount: 30, sharer: '志明', msg: '小籠包必嚐', label: '折抵' },
    ],
    news: [],
  },
  '3': {
    id: '3', name: '85度C', category: 'cafe', lat: 25.0460, lng: 121.5302,
    address: '復興南路 1 段', verified: false, logoUrl: null,
    myCoupons: [],
    sharedCoupons: [],
    news: [],
  },
  '6': {
    id: '6', name: '全家', category: 'convenience', lat: 25.0468, lng: 121.5375,
    address: '中山北路 2 段', verified: true, logoUrl: null,
    myCoupons: [],
    sharedCoupons: [],
    news: [],
  },
};

const mockListNearby = jest.fn<Promise<Merchant[]>, [number, number, number?]>();
const mockGetMerchant = jest.fn<Promise<MerchantDetail>, [string]>();
const mockFlagMerchant = jest.fn<Promise<void>, [string, string, string?]>();
const mockBlockMerchant = jest.fn<Promise<void>, [string]>();

jest.mock('@/src/services/api/merchants', () => ({
  __esModule: true,
  listNearby: (lat: number, lng: number, radius?: number) => mockListNearby(lat, lng, radius),
  getMerchant: (id: string) => mockGetMerchant(id),
  flagMerchant: (id: string, reason: string, details?: string) =>
    mockFlagMerchant(id, reason, details),
  blockMerchant: (id: string) => mockBlockMerchant(id),
}));

// ── Icon mocks ──────────────────────────────────────────────────────────────
jest.mock('@/src/components/icons/LogoIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});
jest.mock('@/src/components/icons/SettingsIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});
jest.mock('@/src/components/icons/GemIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});
jest.mock('@/src/components/icons/CoinIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});

// ── react-native-maps mock ──────────────────────────────────────────────────
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: 'map-view' }, children);
  const Marker = ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) =>
    React.createElement(
      View,
      { testID: 'map-marker', onStartShouldSetResponder: () => true, onPress },
      children,
    );
  return { __esModule: true, default: MapView, Marker };
});

// ── NeoTeardropPin mock — exposes onPress and active via testID ─────────────
// Each pin renders as a Pressable with testID = `pin-<id>` so we can press it
jest.mock('../NeoTeardropPin', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({
    coordinate,
    active,
    count,
    big,
    onPress,
    onLongPress,
  }: {
    coordinate: { latitude: number; longitude: number };
    active?: boolean;
    count?: number;
    big?: boolean;
    onPress?: () => void;
    onLongPress?: () => void;
  }) =>
    React.createElement(
      Pressable,
      {
        testID: `pin-${active ? 'active' : 'inactive'}-${coordinate.latitude.toFixed(4)}`,
        onPress,
        onLongPress,
        accessibilityState: { selected: !!active },
      },
      React.createElement(Text, null, active ? `active-${count ?? 0}` : 'inactive'),
    );
});

// ── react-native-svg mock ───────────────────────────────────────────────────
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const SvgView = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return {
    __esModule: true,
    default: SvgView,
    Svg: SvgView,
    Path: () => null,
    Circle: () => null,
    Line: () => null,
    Rect: () => null,
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

// ── react-native-reanimated mock ────────────────────────────────────────────
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = ({ children, style }: { children?: React.ReactNode; style?: object }) =>
    React.createElement(View, { style }, children);
  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      createAnimatedComponent: (C: React.ComponentType) => C,
    },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withRepeat: (v: unknown) => v,
    withSequence: (...args: unknown[]) => args[0],
    withTiming: (v: unknown) => v,
  };
});

// ── chrome mocks ────────────────────────────────────────────────────────────
jest.mock('@/src/components/chrome/StatusBar', () => 'AppStatusBar');
jest.mock('@/src/components/chrome/TabBar', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return ({ activeTab, onTabPress }: { activeTab: string; onTabPress: (tab: string) => void }) =>
    React.createElement(
      View,
      { testID: 'tab-bar' },
      React.createElement(
        Pressable,
        { testID: 'tab-home', onPress: () => onTabPress('home') },
        React.createElement(Text, null, 'home'),
      ),
      React.createElement(
        Pressable,
        { testID: 'tab-settings', onPress: () => onTabPress('settings') },
        React.createElement(Text, null, 'settings'),
      ),
    );
});

// ── Modal child mocks ───────────────────────────────────────────────────────
jest.mock('../FlagStoreModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({ visible, store, onClose }: { visible: boolean; store: string; onClose: () => void }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'flag-modal' },
          React.createElement(Text, null, store),
          React.createElement(
            Pressable,
            { testID: 'flag-modal-close', onPress: onClose },
            React.createElement(Text, null, '關閉'),
          ),
        )
      : null;
});

jest.mock('../BlockStoreModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    store,
    onConfirm,
    onClose,
  }: {
    visible: boolean;
    store: string;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'block-modal' },
          React.createElement(Text, null, store),
          React.createElement(
            Pressable,
            { testID: 'block-modal-confirm', onPress: onConfirm },
            React.createElement(Text, null, '封鎖'),
          ),
          React.createElement(
            Pressable,
            { testID: 'block-modal-close', onPress: onClose },
            React.createElement(Text, null, '關閉'),
          ),
        )
      : null;
});

jest.mock('../SharedCouponModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    coupon,
    onClaim,
    onClose,
  }: {
    visible: boolean;
    coupon: { store: string; amount: number } | null;
    onClaim: () => void;
    onClose: () => void;
  }) =>
    visible && coupon
      ? React.createElement(
          View,
          { testID: 'shared-coupon-modal' },
          React.createElement(Text, { testID: 'coupon-store' }, coupon.store),
          React.createElement(
            Pressable,
            { testID: 'coupon-claim', onPress: onClaim },
            React.createElement(Text, null, '領取'),
          ),
          React.createElement(
            Pressable,
            { testID: 'coupon-close', onPress: onClose },
            React.createElement(Text, null, '略過'),
          ),
        )
      : null;
});

// MerchantSheet mock — exposes scan + first-shared + first-my callbacks
jest.mock('../MerchantSheet', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    merchant,
    onClose,
    onUseCoupon,
    onClaimSharedCoupon,
    onScanQR,
    onFlag,
    onBlock,
  }: {
    visible: boolean;
    merchant: {
      name: string;
      myCoupons?: Array<{ id: string; detail: string; expires: string; amount: number }>;
      sharedCoupons?: Array<{
        store: string;
        amount: number;
        sharer: string;
        msg: string;
        label?: string;
      }>;
    } | null;
    onClose: () => void;
    onUseCoupon: (c: { id: string; detail: string; expires: string; amount: number }) => void;
    onClaimSharedCoupon: (c: { store: string; amount: number }) => void;
    onScanQR: () => void;
    onFlag?: () => void;
    onBlock?: () => void;
  }) => {
    if (!visible || !merchant) return null;
    const my = merchant.myCoupons?.[0];
    const shared = merchant.sharedCoupons?.[0];
    return React.createElement(
      View,
      { testID: 'merchant-sheet' },
      React.createElement(Text, { testID: 'sheet-store' }, merchant.name),
      React.createElement(
        Pressable,
        { testID: 'sheet-close', onPress: onClose },
        React.createElement(Text, null, 'close'),
      ),
      my
        ? React.createElement(
            Pressable,
            { testID: 'sheet-use-first', onPress: () => onUseCoupon(my) },
            React.createElement(Text, null, 'use'),
          )
        : null,
      shared
        ? React.createElement(
            Pressable,
            { testID: 'sheet-claim-first', onPress: () => onClaimSharedCoupon(shared) },
            React.createElement(Text, null, 'claim'),
          )
        : null,
      React.createElement(
        Pressable,
        { testID: 'sheet-scan', onPress: onScanQR },
        React.createElement(Text, null, 'scan'),
      ),
      onFlag
        ? React.createElement(
            Pressable,
            { testID: 'sheet-flag', onPress: onFlag },
            React.createElement(Text, null, 'flag'),
          )
        : null,
      onBlock
        ? React.createElement(
            Pressable,
            { testID: 'sheet-block', onPress: onBlock },
            React.createElement(Text, null, 'block'),
          )
        : null,
    );
  };
});

// ── Default props ───────────────────────────────────────────────────────────
const defaultProps = {
  onNavigate: jest.fn(),
  gems: 3,
  couPoints: 420,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockListNearby.mockResolvedValue(FIXTURE_MERCHANTS);
  mockGetMerchant.mockImplementation((id: string) =>
    Promise.resolve(FIXTURE_DETAILS[id] ?? FIXTURE_DETAILS['1']),
  );
  mockFlagMerchant.mockResolvedValue(undefined);
  mockBlockMerchant.mockResolvedValue(undefined);
  // Default: permission granted, device near a known LAT/LNG that should
  // trigger a fresh listNearby() call.
  mockRequestPermission.mockResolvedValue({ status: 'granted', granted: true });
  mockGetPermission.mockResolvedValue({ status: 'granted', granted: true });
  mockGetCurrentPosition.mockResolvedValue({
    coords: { latitude: 25.0333, longitude: 121.5654, accuracy: 10 },
    timestamp: Date.now(),
  });
  mockHeadingRemove.mockReset();
  mockPositionRemove.mockReset();
  mockWatchHeading.mockReset();
  mockWatchPosition.mockReset();
  // Default: subscriptions return a remover, no automatic emissions.
  mockWatchHeading.mockResolvedValue({ remove: mockHeadingRemove });
  mockWatchPosition.mockResolvedValue({ remove: mockPositionRemove });
});

/** Render MapScreen and wait for the listNearby fetch to commit pins. */
async function renderMap(props = defaultProps) {
  const utils = render(<MapScreen {...props} />);
  await waitFor(() => {
    expect(utils.getAllByText(/^active-/).length).toBeGreaterThan(0);
  });
  return utils;
}

/** Press a pin and await the getMerchant resolution that opens the sheet. */
async function openPinSheet(utils: ReturnType<typeof render>, testId: string) {
  await act(async () => {
    fireEvent.press(utils.getByTestId(testId));
  });
}

// ── Test suites ─────────────────────────────────────────────────────────────

describe('MapScreen', () => {
  it('renders without crash', async () => {
    const utils = await renderMap();
    expect(utils.toJSON()).toBeTruthy();
  });

  it('renders 4 active pins from listNearby', async () => {
    const { getAllByText } = await renderMap();
    const activePins = getAllByText(/^active-/);
    expect(activePins.length).toBe(4);
  });

  it('calls listNearby with fallback coordinates and NO radius on mount', async () => {
    // Omitting radius = backend returns every store, no proximity filter.
    await renderMap();
    expect(mockListNearby).toHaveBeenCalledWith(25.0478, 121.5318, undefined);
  });

  it('does not render inactive pins (none returned by listNearby)', async () => {
    const { queryAllByText } = await renderMap();
    expect(queryAllByText('inactive')).toHaveLength(0);
  });
});

describe('MapScreen — header badges', () => {
  it('renders search input', async () => {
    const { getByPlaceholderText } = await renderMap();
    expect(getByPlaceholderText('搜尋店家或優惠…')).toBeTruthy();
  });
});

describe('MapScreen — locate button', () => {
  it('renders the locate button', async () => {
    const utils = await renderMap();
    expect(utils.getByTestId('locate-btn')).toBeTruthy();
  });

  it('requests permission, reads position, and re-fetches nearby with the new coords', async () => {
    const utils = await renderMap();
    mockListNearby.mockClear();
    await act(async () => {
      fireEvent.press(utils.getByTestId('locate-btn'));
    });
    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(mockListNearby).toHaveBeenCalledWith(25.0333, 121.5654, undefined);
    });
  });

  it('does NOT re-fetch when permission is denied', async () => {
    mockRequestPermission.mockResolvedValueOnce({ status: 'denied', granted: false });
    const utils = await renderMap();
    mockListNearby.mockClear();
    mockGetCurrentPosition.mockClear();
    await act(async () => {
      fireEvent.press(utils.getByTestId('locate-btn'));
    });
    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(mockListNearby).not.toHaveBeenCalled();
  });

  it('disables the button while locating to prevent double-fires', async () => {
    let resolvePosition: (v: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }) => void = () => undefined;
    mockGetCurrentPosition.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolvePosition = res;
        }),
    );
    const utils = await renderMap();
    mockListNearby.mockClear();
    await act(async () => {
      fireEvent.press(utils.getByTestId('locate-btn'));
    });
    // Second press while the first is in-flight should be a no-op.
    await act(async () => {
      fireEvent.press(utils.getByTestId('locate-btn'));
    });
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    // Resolve to clean up.
    await act(async () => {
      resolvePosition({
        coords: { latitude: 1, longitude: 2, accuracy: 1 },
        timestamp: Date.now(),
      });
    });
  });
});

describe('MapScreen — flag flow (via merchant sheet)', () => {
  it('opens FlagStoreModal when flag button in sheet is pressed', async () => {
    const utils = await renderMap();
    expect(utils.queryByTestId('flag-modal')).toBeNull();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-flag'));
    expect(utils.getByTestId('flag-modal')).toBeTruthy();
  });

  it('FlagStoreModal onClose hides the modal', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-flag'));
    fireEvent.press(utils.getByTestId('flag-modal-close'));
    expect(utils.queryByTestId('flag-modal')).toBeNull();
  });

  it('opening flag from sheet also closes the sheet', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-flag'));
    expect(utils.queryByTestId('merchant-sheet')).toBeNull();
  });
});

describe('MapScreen — block flow (via merchant sheet)', () => {
  it('opens BlockStoreModal when block button in sheet is pressed', async () => {
    const utils = await renderMap();
    expect(utils.queryByTestId('block-modal')).toBeNull();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-block'));
    expect(utils.getByTestId('block-modal')).toBeTruthy();
  });

  it('BlockStoreModal onClose hides the modal', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-block'));
    fireEvent.press(utils.getByTestId('block-modal-close'));
    expect(utils.queryByTestId('block-modal')).toBeNull();
  });

  it('BlockStoreModal onConfirm hides the modal and calls blockMerchant', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-block'));
    fireEvent.press(utils.getByTestId('block-modal-confirm'));
    expect(utils.queryByTestId('block-modal')).toBeNull();
    expect(mockBlockMerchant).toHaveBeenCalledWith('1');
  });
});

describe('MapScreen — shared coupon modal', () => {
  it('SharedCouponModal is not shown initially (no auto-pop on mount)', async () => {
    const utils = await renderMap();
    expect(utils.queryByTestId('shared-coupon-modal')).toBeNull();
  });

  it('claiming a shared coupon from the merchant sheet opens SharedCouponModal', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-claim-first'));
    expect(utils.queryByTestId('shared-coupon-modal')).toBeTruthy();
    expect(utils.getByTestId('coupon-store').props.children).toBe('阿明早餐店');
  });

  it('SharedCouponModal closes on onClose', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-claim-first'));
    fireEvent.press(utils.getByTestId('coupon-close'));
    expect(utils.queryByTestId('shared-coupon-modal')).toBeNull();
  });

  it('SharedCouponModal closes on onClaim', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-claim-first'));
    fireEvent.press(utils.getByTestId('coupon-claim'));
    expect(utils.queryByTestId('shared-coupon-modal')).toBeNull();
  });
});

describe('MapScreen — flag modal shows tapped merchant', () => {
  it('flag modal shows the merchant whose pin opened the sheet', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-flag'));
    expect(utils.getByTestId('flag-modal')).toBeTruthy();
    expect(utils.getByText('阿明早餐店')).toBeTruthy();
  });

  it('flag modal shows a different merchant when a different pin is opened', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0490');
    fireEvent.press(utils.getByTestId('sheet-flag'));
    expect(utils.getByText('鼎泰豐')).toBeTruthy();
  });
});

describe('MapScreen — pin press opens MerchantSheet', () => {
  it('pressing active pin opens the merchant sheet (does NOT navigate immediately)', async () => {
    const onNavigate = jest.fn();
    const utils = await renderMap({ ...defaultProps, onNavigate });
    await openPinSheet(utils, 'pin-active-25.0478');
    expect(utils.getByTestId('merchant-sheet')).toBeTruthy();
    expect(utils.getByTestId('sheet-store').props.children).toBe('阿明早餐店');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('pressing a second active pin opens the sheet for that merchant', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0490');
    expect(utils.getByTestId('sheet-store').props.children).toBe('鼎泰豐');
  });

  it('inactive merchants returned by listNearby would not crash (none in fixture)', async () => {
    const utils = await renderMap();
    expect(utils.queryByTestId('pin-inactive-25.0452')).toBeNull();
  });

  it('sheet "use coupon" callback navigates to coupon-detail with full params', async () => {
    const onNavigate = jest.fn();
    const utils = await renderMap({ ...defaultProps, onNavigate });
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-use-first'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-detail', {
      store: '阿明早餐店',
      detail: '$25 現金折抵',
      expires: '11/08',
      amount: 25,
    });
    expect(utils.queryByTestId('merchant-sheet')).toBeNull();
  });

  it('sheet scan QR callback navigates to coupon-receive', async () => {
    const onNavigate = jest.fn();
    const utils = await renderMap({ ...defaultProps, onNavigate });
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-scan'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-receive');
    expect(utils.queryByTestId('merchant-sheet')).toBeNull();
  });

  it('sheet close button hides the sheet', async () => {
    const utils = await renderMap();
    await openPinSheet(utils, 'pin-active-25.0478');
    fireEvent.press(utils.getByTestId('sheet-close'));
    expect(utils.queryByTestId('merchant-sheet')).toBeNull();
  });
});

describe('MapScreen — user heading marker', () => {
  it('subscribes to heading + position on mount and removes both on unmount', async () => {
    const utils = await renderMap();
    // Both subscriptions were started on mount.
    expect(mockWatchHeading).toHaveBeenCalled();
    expect(mockWatchPosition).toHaveBeenCalled();
    // The subscriptions resolve to objects with .remove; mount → unmount must
    // call them. We unmount and let the async cleanup run via act().
    await act(async () => {
      utils.unmount();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockHeadingRemove).toHaveBeenCalledTimes(1);
    expect(mockPositionRemove).toHaveBeenCalledTimes(1);
  });

  it('renders the user-location marker once a position fix arrives', async () => {
    let positionCb: ((p: { coords: { latitude: number; longitude: number } }) => void) | null = null;
    mockWatchPosition.mockImplementationOnce(
      (_opts: unknown, cb: (p: { coords: { latitude: number; longitude: number } }) => void) => {
        positionCb = cb;
        return Promise.resolve({ remove: mockPositionRemove });
      },
    );

    const utils = await renderMap();
    // Before any position emission, no marker.
    expect(utils.queryByTestId('user-location-marker')).toBeNull();

    await act(async () => {
      positionCb?.({ coords: { latitude: 25.0478, longitude: 121.5318 } });
      await Promise.resolve();
    });

    expect(utils.getByTestId('user-location-marker')).toBeTruthy();
  });
});

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import MapScreen from '../MapScreen';

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

// ── Default props ───────────────────────────────────────────────────────────
const defaultProps = {
  onNavigate: jest.fn(),
  gems: 3,
  couPoints: 420,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Test suites ─────────────────────────────────────────────────────────────

describe('MapScreen', () => {
  it('renders without crash', () => {
    const { toJSON } = render(<MapScreen {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders 4 active pins', () => {
    const { getAllByText } = render(<MapScreen {...defaultProps} />);
    // SAMPLE_MERCHANTS: 4 active (ids 1,2,3,6)
    const activePins = getAllByText(/^active-/);
    expect(activePins.length).toBe(4);
  });

  it('renders 3 inactive pins', () => {
    const { getAllByText } = render(<MapScreen {...defaultProps} />);
    // SAMPLE_MERCHANTS: 3 inactive (ids 4,5,7)
    const inactivePins = getAllByText('inactive');
    expect(inactivePins.length).toBe(3);
  });
});

describe('MapScreen — header badges', () => {
  it('renders without crashing', () => {
    const { getByPlaceholderText } = render(<MapScreen {...defaultProps} />);
    expect(getByPlaceholderText('搜尋店家或優惠…')).toBeTruthy();
  });
});

describe('MapScreen — flag button', () => {
  it('flag button press opens FlagStoreModal', () => {
    const { getByText, queryByTestId } = render(<MapScreen {...defaultProps} />);
    expect(queryByTestId('flag-modal')).toBeNull();
    fireEvent.press(getByText('⚑'));
    expect(queryByTestId('flag-modal')).toBeTruthy();
  });

  it('FlagStoreModal onClose hides the modal', () => {
    const { getByText, getByTestId, queryByTestId } = render(<MapScreen {...defaultProps} />);
    fireEvent.press(getByText('⚑'));
    expect(getByTestId('flag-modal')).toBeTruthy();
    fireEvent.press(getByTestId('flag-modal-close'));
    expect(queryByTestId('flag-modal')).toBeNull();
  });
});

describe('MapScreen — block button', () => {
  it('block button press opens BlockStoreModal', () => {
    const { getByText, queryByTestId } = render(<MapScreen {...defaultProps} />);
    expect(queryByTestId('block-modal')).toBeNull();
    fireEvent.press(getByText('🚫'));
    expect(queryByTestId('block-modal')).toBeTruthy();
  });

  it('BlockStoreModal onClose hides the modal', () => {
    const { getByText, getByTestId, queryByTestId } = render(<MapScreen {...defaultProps} />);
    fireEvent.press(getByText('🚫'));
    fireEvent.press(getByTestId('block-modal-close'));
    expect(queryByTestId('block-modal')).toBeNull();
  });

  it('BlockStoreModal onConfirm hides the modal', () => {
    const { getByText, getByTestId, queryByTestId } = render(<MapScreen {...defaultProps} />);
    fireEvent.press(getByText('🚫'));
    fireEvent.press(getByTestId('block-modal-confirm'));
    expect(queryByTestId('block-modal')).toBeNull();
  });
});

describe('MapScreen — shared coupon modal (timer)', () => {
  it('SharedCouponModal is not shown before timeout', () => {
    const { queryByTestId } = render(<MapScreen {...defaultProps} />);
    expect(queryByTestId('shared-coupon-modal')).toBeNull();
  });

  it('SharedCouponModal appears after 3 seconds', () => {
    const { queryByTestId } = render(<MapScreen {...defaultProps} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(queryByTestId('shared-coupon-modal')).toBeTruthy();
  });

  it('SharedCouponModal shows the demo store name', () => {
    const { getByTestId } = render(<MapScreen {...defaultProps} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(getByTestId('coupon-store').props.children).toBe('阿明早餐店');
  });

  it('closing SharedCouponModal via onClose hides it', () => {
    const { getByTestId, queryByTestId } = render(<MapScreen {...defaultProps} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    fireEvent.press(getByTestId('coupon-close'));
    expect(queryByTestId('shared-coupon-modal')).toBeNull();
  });

  it('claiming SharedCouponModal via onClaim hides it', () => {
    const { getByTestId, queryByTestId } = render(<MapScreen {...defaultProps} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    fireEvent.press(getByTestId('coupon-claim'));
    expect(queryByTestId('shared-coupon-modal')).toBeNull();
  });
});

describe('MapScreen — flag modal shows selected store', () => {
  it('flag modal shows the default selected store name', () => {
    const { getByText, getByTestId } = render(<MapScreen {...defaultProps} />);
    fireEvent.press(getByText('⚑'));
    // Default selectedStore is '阿明早餐店'
    expect(getByTestId('flag-modal')).toBeTruthy();
    expect(getByText('阿明早餐店')).toBeTruthy();
  });
});

describe('MapScreen — pin press interactions', () => {
  it('pressing active pin calls onNavigate with coupon-detail', () => {
    const onNavigate = jest.fn();
    // Merchant 1: lat 25.0478, active, name='阿明早餐店', couponCount=3
    const { getByTestId } = render(<MapScreen {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.press(getByTestId('pin-active-25.0478'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-detail', {
      store: '阿明早餐店',
      couponCount: 3,
    });
  });

  it('pressing a second active pin calls onNavigate with correct store', () => {
    const onNavigate = jest.fn();
    // Merchant 2: lat 25.049, active, name='鼎泰豐', couponCount=5
    const { getByTestId } = render(<MapScreen {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.press(getByTestId('pin-active-25.0490'));
    expect(onNavigate).toHaveBeenCalledWith('coupon-detail', {
      store: '鼎泰豐',
      couponCount: 5,
    });
  });

  it('pressing inactive pin does not call onNavigate', () => {
    const onNavigate = jest.fn();
    // Merchant 4: lat 25.0452, inactive
    const { getByTestId } = render(<MapScreen {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.press(getByTestId('pin-inactive-25.0452'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('pressing another inactive pin does not call onNavigate', () => {
    const onNavigate = jest.fn();
    // Merchant 5: lat 25.0485, inactive
    const { getByTestId } = render(<MapScreen {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.press(getByTestId('pin-inactive-25.0485'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

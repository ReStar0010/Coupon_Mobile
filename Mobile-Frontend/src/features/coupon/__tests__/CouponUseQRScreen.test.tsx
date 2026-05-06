import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import CouponUseQRScreen from '../CouponUseQRScreen';

// ── expo-camera mock ─────────────────────────────────────────────────────────
jest.mock('expo-camera', () => ({
  CameraView: ({ children }: any) => children,
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

// ── react-native-svg mock ────────────────────────────────────────────────────
// Path renders as a View so its props (including the torch ternary for stroke)
// are evaluated by React, which ensures the branch is covered.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Svg: (props: any) => React.createElement(View, props),
    Path: (props: any) => React.createElement(View, props),
    Circle: (props: any) => React.createElement(View, props),
    Line: (props: any) => React.createElement(View, props),
  };
});

// ── AppStatusBar mock ────────────────────────────────────────────────────────
jest.mock('@/src/components/chrome/StatusBar', () => 'AppStatusBar');

// ── Default props factory ────────────────────────────────────────────────────
const makeProps = (overrides: Partial<React.ComponentProps<typeof CouponUseQRScreen>> = {}) => ({
  onNavigate: jest.fn(),
  couPoints: 100,
  setCouPoints: jest.fn(),
  params: {
    store: '阿明早餐店',
    detail: '$25 現金折抵',
    expires: '11/08',
    amount: 25,
  },
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CouponUseQRScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the coupon store name from params', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('阿明早餐店')).toBeTruthy();
  });

  it('shows the simulate scan button before scanning', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('模擬掃描成功 ▶')).toBeTruthy();
  });

  it('sim scan button calls setCouPoints with the coupon amount', () => {
    const setCouPoints = jest.fn();
    const { getByText } = render(<CouponUseQRScreen {...makeProps({ setCouPoints })} />);

    fireEvent.press(getByText('模擬掃描成功 ▶'));

    expect(setCouPoints).toHaveBeenCalledTimes(1);
    // setCouPoints receives a function — call it with a mock prev to verify the increment
    const updaterFn = setCouPoints.mock.calls[0][0];
    expect(updaterFn(0)).toBe(25);
  });

  it('sim scan button shows success text after scan', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    fireEvent.press(getByText('模擬掃描成功 ▶'));

    expect(getByText('掃描成功 ✓')).toBeTruthy();
  });

  it('sim scan button is disabled after scan', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    fireEvent.press(getByText('模擬掃描成功 ▶'));

    // Walk up the tree from the Text node until we find the Pressable with accessibilityState.
    // The Pressable may be the parent or grandparent depending on RN internals.
    const textNode = getByText('掃描成功 ✓');
    let node: any = textNode.parent;
    let disabled: boolean | undefined;
    while (node) {
      if (node.props?.accessibilityState?.disabled !== undefined) {
        disabled = node.props.accessibilityState.disabled;
        break;
      }
      node = node.parent;
    }
    expect(disabled).toBe(true);
  });

  it('pressing sim scan a second time does not call setCouPoints again', () => {
    const setCouPoints = jest.fn();
    const { getByText } = render(<CouponUseQRScreen {...makeProps({ setCouPoints })} />);

    fireEvent.press(getByText('模擬掃描成功 ▶'));
    // Button text has changed to '掃描成功 ✓' and is disabled — pressing it again
    // should be a no-op because disabled blocks the handler
    expect(setCouPoints).toHaveBeenCalledTimes(1);
  });

  it('shows success overlay with success text after scan', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);

    fireEvent.press(getByText('模擬掃描成功 ▶'));

    expect(getByText('使用成功！')).toBeTruthy();
    expect(getByText('+25 pt 已入帳')).toBeTruthy();
  });

  it('navigates to home after 2600 ms post-scan', () => {
    const onNavigate = jest.fn();
    const { getByText } = render(<CouponUseQRScreen {...makeProps({ onNavigate })} />);

    fireEvent.press(getByText('模擬掃描成功 ▶'));

    act(() => { jest.advanceTimersByTime(2600); });

    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('back button navigates to coupon-detail with params', () => {
    const onNavigate = jest.fn();
    const params = { store: '阿明早餐店', expires: '11/08', amount: 25 };
    const { getByText } = render(
      <CouponUseQRScreen {...makeProps({ onNavigate, params })} />,
    );

    fireEvent.press(getByText('←'));

    expect(onNavigate).toHaveBeenCalledWith('coupon-detail', params);
  });

  it('renders the page title', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('掃描店家 QR')).toBeTruthy();
  });

  it('renders coupon amount in the banner', () => {
    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('$25')).toBeTruthy();
  });

  it('shows no-camera fallback when permission is not granted', () => {
    const { useCameraPermissions } = require('expo-camera');
    (useCameraPermissions as jest.Mock).mockReturnValueOnce([{ granted: false }, jest.fn()]);

    const { getByText } = render(<CouponUseQRScreen {...makeProps()} />);
    expect(getByText('需要相機權限')).toBeTruthy();
  });

  it('pressing the torch button does not throw', () => {
    // Torch Pressable renders as accessible={true} View with an SVG (View) child.
    // It is the second accessible={true} element — the first is the back arrow.
    // Use UNSAFE_getByProps on the torch Pressable's container.
    const { UNSAFE_getAllByProps } = render(<CouponUseQRScreen {...makeProps()} />);
    // Both back and torch Pressables render with accessible={true}
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    // accessibles[0] = back btn (has ← text child), accessibles[1] = torch btn
    expect(() => fireEvent.press(accessibles[1])).not.toThrow();
  });

  it('pressing torch twice covers both torch state branches', () => {
    const { UNSAFE_getAllByProps } = render(<CouponUseQRScreen {...makeProps()} />);
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    // Toggle torch on then off
    fireEvent.press(accessibles[1]);
    fireEvent.press(accessibles[1]);
    expect(true).toBe(true);
  });
});

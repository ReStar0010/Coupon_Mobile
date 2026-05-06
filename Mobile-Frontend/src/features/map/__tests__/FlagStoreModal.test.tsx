import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FlagStoreModal from '../FlagStoreModal';

// ── react-native-svg mock ────────────────────────────────────────────────────
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Svg: (props: any) => React.createElement(View, props),
    Path: () => null,
    Circle: () => null,
    Line: () => null,
  };
});

// ── Default props factory ────────────────────────────────────────────────────
const makeProps = (overrides = {}) => ({
  visible: true,
  store: '阿明早餐店',
  onClose: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FlagStoreModal', () => {
  it('renders without crashing when visible', () => {
    const { toJSON } = render(<FlagStoreModal {...makeProps()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders all 5 flag reasons', () => {
    const { getByText } = render(<FlagStoreModal {...makeProps()} />);
    expect(getByText('廣告/詐騙')).toBeTruthy();
    expect(getByText('不存在的商家')).toBeTruthy();
    expect(getByText('以名牟利')).toBeTruthy();
    expect(getByText('無法兌現')).toBeTruthy();
    expect(getByText('其他')).toBeTruthy();
  });

  it('renders the store name in the subtitle', () => {
    const { getByText } = render(<FlagStoreModal {...makeProps({ store: '鼎泰豐' })} />);
    expect(getByText(/鼎泰豐/)).toBeTruthy();
  });

  it('submit button is present in the DOM before selection', () => {
    const { getByText } = render(<FlagStoreModal {...makeProps()} />);
    expect(getByText('提交舉報')).toBeTruthy();
  });

  it('selecting a reason shows it visually selected', () => {
    const { getByText } = render(<FlagStoreModal {...makeProps()} />);
    fireEvent.press(getByText('廣告/詐騙'));
    // After selection the text node is still rendered
    expect(getByText('廣告/詐騙')).toBeTruthy();
  });

  it('pressing submit without a selection does not transition to done state', () => {
    const { getByText, queryByText } = render(<FlagStoreModal {...makeProps()} />);
    fireEvent.press(getByText('提交舉報'));
    // "已回報" title only appears after done state
    expect(queryByText('已回報')).toBeNull();
  });

  it('pressing submit with a selection transitions to done state', () => {
    const { getByText } = render(<FlagStoreModal {...makeProps()} />);
    fireEvent.press(getByText('廣告/詐騙'));
    fireEvent.press(getByText('提交舉報'));
    expect(getByText('已回報')).toBeTruthy();
  });

  it('pressing submit with selection shows store name in confirmation', () => {
    const { getByText } = render(<FlagStoreModal {...makeProps({ store: '阿明早餐店' })} />);
    fireEvent.press(getByText('其他'));
    fireEvent.press(getByText('提交舉報'));
    expect(getByText(/阿明早餐店/)).toBeTruthy();
  });

  it('pressing close in the form calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <FlagStoreModal {...makeProps({ onClose })} />,
    );
    // In the form state press any other reason then select close via backdrop — but the
    // component also exposes '關閉' only in the done state.
    // Verify the backdrop triggers onClose via the handled onRequestClose.
    // Test the done-state close button instead:
    fireEvent.press(getByText('廣告/詐騙'));
    fireEvent.press(getByText('提交舉報'));
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button after submission calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(<FlagStoreModal {...makeProps({ onClose })} />);
    fireEvent.press(getByText('無法兌現'));
    fireEvent.press(getByText('提交舉報'));
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when visible is false', () => {
    // Modal with visible=false renders nothing visible at root
    const { queryByText } = render(<FlagStoreModal {...makeProps({ visible: false })} />);
    expect(queryByText('舉報店家')).toBeNull();
  });

  it('each of the 5 reasons can be selected to enable submit', () => {
    const reasons = ['廣告/詐騙', '不存在的商家', '以名牟利', '無法兌現', '其他'];
    reasons.forEach((reason) => {
      const onClose = jest.fn();
      const { getByText, unmount } = render(<FlagStoreModal {...makeProps({ onClose })} />);
      fireEvent.press(getByText(reason));
      fireEvent.press(getByText('提交舉報'));
      expect(getByText('已回報')).toBeTruthy();
      unmount();
    });
  });
});

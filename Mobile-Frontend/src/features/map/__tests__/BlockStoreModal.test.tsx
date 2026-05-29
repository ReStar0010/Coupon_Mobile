import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BlockStoreModal from '../BlockStoreModal';

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
  onConfirm: jest.fn(),
  onClose: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BlockStoreModal', () => {
  it('renders without crashing when visible', () => {
    const { toJSON } = render(<BlockStoreModal {...makeProps()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the title "封鎖此商家？"', () => {
    const { getByText } = render(<BlockStoreModal {...makeProps()} />);
    expect(getByText('封鎖此商家？')).toBeTruthy();
  });

  it('renders the store name in the body text', () => {
    const { getByText } = render(<BlockStoreModal {...makeProps({ store: '鼎泰豐' })} />);
    expect(getByText(/鼎泰豐/)).toBeTruthy();
  });

  it('renders cancel and confirm buttons', () => {
    const { getByText } = render(<BlockStoreModal {...makeProps()} />);
    expect(getByText('取消')).toBeTruthy();
    expect(getByText('封鎖')).toBeTruthy();
  });

  it('pressing cancel calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(<BlockStoreModal {...makeProps({ onClose })} />);
    fireEvent.press(getByText('取消'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing cancel does not call onConfirm', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(<BlockStoreModal {...makeProps({ onConfirm, onClose })} />);
    fireEvent.press(getByText('取消'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('pressing confirm calls onConfirm', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(<BlockStoreModal {...makeProps({ onConfirm })} />);
    fireEvent.press(getByText('封鎖'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('pressing confirm transitions to blocked state', () => {
    const { getByText } = render(<BlockStoreModal {...makeProps()} />);
    fireEvent.press(getByText('封鎖'));
    expect(getByText('已封鎖')).toBeTruthy();
  });

  it('blocked state shows store name in confirmation text', () => {
    const { getByText } = render(<BlockStoreModal {...makeProps({ store: '阿明早餐店' })} />);
    fireEvent.press(getByText('封鎖'));
    expect(getByText(/阿明早餐店/)).toBeTruthy();
  });

  it('close button in blocked state calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(<BlockStoreModal {...makeProps({ onClose })} />);
    fireEvent.press(getByText('封鎖'));
    fireEvent.press(getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show blocked state initially', () => {
    const { queryByText } = render(<BlockStoreModal {...makeProps()} />);
    expect(queryByText('已封鎖')).toBeNull();
  });

  it('does not render content when visible is false', () => {
    const { queryByText } = render(<BlockStoreModal {...makeProps({ visible: false })} />);
    expect(queryByText('封鎖此商家？')).toBeNull();
  });

  it('renders the hint text about how to unblock', () => {
    const { getByText } = render(<BlockStoreModal {...makeProps()} />);
    expect(getByText(/解除封鎖/)).toBeTruthy();
  });
});

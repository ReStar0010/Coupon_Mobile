import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SpinnerScreen from '../SpinnerScreen';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mock = (name: string) => {
    const C = ({ children, ...p }: any) => React.createElement(View, p, children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: mock('Svg'),
    Svg: mock('Svg'),
    Path: mock('Path'),
    Circle: mock('Circle'),
    Line: mock('Line'),
    G: mock('G'),
    Text: mock('SvgText'),
    Polygon: mock('Polygon'),
    Rect: mock('Rect'),
  };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

function makeProps(overrides = {}) {
  return {
    onNavigate: jest.fn(),
    gems: 1,
    setGems: jest.fn(),
    couPoints: 0,
    setCouPoints: jest.fn(),
    ...overrides,
  };
}

describe('SpinnerScreen', () => {
  it('renders spin button', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps()} />);
    expect(getByTestId('spin-button')).toBeTruthy();
  });

  it('spin button is enabled when not spinning and guests filled (1 player = no guests needed)', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps({ gems: 1 })} />);
    const btn = getByTestId('spin-button');
    expect(btn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('spin button disabled when spinning=true (via internal state)', () => {
    jest.useFakeTimers();
    const props = makeProps({ gems: 2 });
    const { getByTestId } = render(<SpinnerScreen {...props} />);
    const btn = getByTestId('spin-button');

    act(() => {
      fireEvent.press(btn);
    });

    // After pressing, spinning becomes true — button should be disabled
    expect(getByTestId('spin-button').props.accessibilityState?.disabled).toBe(true);
    jest.useRealTimers();
  });

  it('spin deducts gem on press by calling setGems', () => {
    jest.useFakeTimers();
    const setGems = jest.fn();
    const props = makeProps({ gems: 3, setGems });
    const { getByTestId } = render(<SpinnerScreen {...props} />);
    const btn = getByTestId('spin-button');

    act(() => {
      fireEvent.press(btn);
    });

    expect(setGems).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('renders player slot avatars', () => {
    const { getAllByTestId } = render(<SpinnerScreen {...makeProps()} />);
    expect(getAllByTestId('player-slot')).toHaveLength(1);
  });

  it('renders gem pips', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps({ gems: 3 })} />);
    expect(getByTestId('gem-pips-container')).toBeTruthy();
  });

  it('shows couPoints badge', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps({ couPoints: 42 })} />);
    expect(getByTestId('coupoints-badge')).toBeTruthy();
  });

  it('shows gems badge', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps({ gems: 2 })} />);
    expect(getByTestId('gems-badge')).toBeTruthy();
  });
});

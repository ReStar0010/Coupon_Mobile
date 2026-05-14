import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SpinnerScreen from '../SpinnerScreen';
import { drawSpinner } from '../../../services/api/spinner';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

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

jest.mock('../../../services/api/spinner', () => ({
  drawSpinner: jest.fn(),
  getSpinnerState: jest.fn(),
}));

const mockedDrawSpinner = drawSpinner as jest.MockedFunction<typeof drawSpinner>;

function makeProps(overrides = {}) {
  return {
    onNavigate: jest.fn(),
    gems: 1,
    setGems: jest.fn(),
    couPoints: 0,
    setCouPoints: jest.fn(),
    refreshWallet: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SpinnerScreen', () => {
  beforeEach(() => {
    mockedDrawSpinner.mockReset();
    mockedDrawSpinner.mockResolvedValue({
      multiplier: 2,
      meltdownMultiplier: null,
      gemsUsed: 1,
      pointsEarned: 2,
      gems: 0,
      couPoints: 2,
      transactionId: 1,
      floor: 0,
      spunAt: new Date().toISOString(),
    });
  });

  it('renders spin button', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps()} />);
    expect(getByTestId('spin-button')).toBeTruthy();
  });

  it('spin button is enabled when not spinning and guests filled (1 player = no guests needed)', () => {
    const { getByTestId } = render(<SpinnerScreen {...makeProps({ gems: 1 })} />);
    const btn = getByTestId('spin-button');
    expect(btn.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('spin button disabled after press (spinning becomes true)', async () => {
    const props = makeProps({ gems: 2 });
    const { getByTestId } = render(<SpinnerScreen {...props} />);
    const btn = getByTestId('spin-button');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(getByTestId('spin-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('press calls drawSpinner with current gem count', async () => {
    const props = makeProps({ gems: 3 });
    const { getByTestId } = render(<SpinnerScreen {...props} />);
    const btn = getByTestId('spin-button');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(mockedDrawSpinner).toHaveBeenCalledTimes(1);
    expect(mockedDrawSpinner).toHaveBeenCalledWith(3);
  });

  it('does not mutate local gem balance via setGems (server owns the debit)', async () => {
    const setGems = jest.fn();
    const props = makeProps({ gems: 3, setGems });
    const { getByTestId } = render(<SpinnerScreen {...props} />);
    const btn = getByTestId('spin-button');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(setGems).not.toHaveBeenCalled();
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

/**
 * UserLocationMarker contract tests.
 *
 * Platform split:
 *   Android — Marker `rotation` prop, `tracksViewChanges={false}`.
 *   iOS    — SVG `<G transform="rotate(…)">` on the cone, Marker
 *            `rotation={0}`, `tracksViewChanges` briefly true then false
 *            so MapKit re-snapshots the rotated bitmap.
 *
 * Guards the iOS "marker jumps between center and top-left" bug that
 * occurred when a View-level `transform: [{ rotate }]` re-rasterised the
 * marker at 10 Hz. The current approach avoids View transforms entirely.
 */
import React from 'react';
import { Platform } from 'react-native';
import { render, act } from '@testing-library/react-native';

// Capture Marker props onto a global so tests can read them.
jest.mock('react-native-maps', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    Marker: (props: Record<string, unknown>) => {
      (globalThis as Record<string, unknown>).__markerProps = props;
      return ReactLocal.createElement(View, { testID: 'mock-marker' }, props.children as unknown);
    },
  };
});

jest.mock('react-native-svg', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactLocal.createElement(View, props),
    Svg: (props: Record<string, unknown>) =>
      ReactLocal.createElement(View, { ...props, testID: 'svg-root' }),
    G: (props: Record<string, unknown>) =>
      ReactLocal.createElement(View, { ...props, testID: 'svg-g' }),
    Path: (props: Record<string, unknown>) =>
      ReactLocal.createElement(View, { ...props, testID: 'svg-path' }),
    Circle: (props: Record<string, unknown>) =>
      ReactLocal.createElement(View, { ...props, testID: 'svg-circle' }),
  };
});

import UserLocationMarker from '../UserLocationMarker';

const HOLDING_COORD = { latitude: 25.0478, longitude: 121.5318 };

function getMarkerProps(): Record<string, unknown> {
  return (globalThis as Record<string, unknown>).__markerProps as Record<string, unknown>;
}

function withPlatform(os: string, fn: () => void) {
  const original = Platform.OS;
  (Platform as { OS: string }).OS = os;
  try {
    fn();
  } finally {
    (Platform as { OS: string }).OS = original;
  }
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).__markerProps = undefined;
});

describe('UserLocationMarker', () => {
  // ── Android (native rotation) ──────────────────────────────────────

  it('Android: passes heading to Marker via native rotation prop', () => {
    withPlatform('android', () => {
      render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
      expect(getMarkerProps().rotation).toBe(42);
    });
  });

  it('Android: keeps tracksViewChanges={false}', () => {
    withPlatform('android', () => {
      render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
      expect(getMarkerProps().tracksViewChanges).toBe(false);
    });
  });

  // ── iOS (SVG rotation + tracksViewChanges toggle) ──────────────────

  it('iOS: sets Marker rotation to 0 (rotation is in the SVG, not the Marker)', () => {
    withPlatform('ios', () => {
      render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
      expect(getMarkerProps().rotation).toBe(0);
    });
  });

  it('iOS: rotates the cone via SVG <G transform>', () => {
    withPlatform('ios', () => {
      const { getByTestId } = render(
        <UserLocationMarker coordinate={HOLDING_COORD} heading={42} />,
      );
      const g = getByTestId('svg-g');
      expect(g.props.transform).toBe('rotate(42, 22, 22)');
    });
  });

  it('iOS: settles tracksViewChanges to false after the re-snapshot window', () => {
    jest.useFakeTimers();
    withPlatform('ios', () => {
      render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
      act(() => jest.advanceTimersByTime(200));
      expect(getMarkerProps().tracksViewChanges).toBe(false);
    });
    jest.useRealTimers();
  });

  // ── Shared behaviour ──────────────────────────────────────────────

  it('sets rotation to 0 when heading is null', () => {
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={null} />);
    // On the default test platform (ios), Marker rotation is always 0.
    // On Android it would be 0 because heading ?? 0 = 0. Either way, 0.
    expect(getMarkerProps().rotation).toBe(0);
  });

  it('inner View has NO transform: rotate style', () => {
    const { toJSON } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={42} />,
    );
    const tree = JSON.stringify(toJSON());
    // SVG <G transform="rotate(…)"> is fine — it's a string prop on an SVG
    // element, not a React Native View `transform` style array. We only
    // guard against the View-level transform that caused the flicker bug.
    expect(tree).not.toMatch(/"transform":\[.*rotate/);
  });

  it('omits the heading-cone Path when heading is null', () => {
    const { queryByTestId } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={null} />,
    );
    expect(queryByTestId('svg-path')).toBeNull();
    expect(queryByTestId('svg-circle')).toBeTruthy();
  });

  it('renders the heading-cone Path when heading is a number (even 0)', () => {
    const { queryByTestId } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={0} />,
    );
    expect(queryByTestId('svg-path')).toBeTruthy();
  });

  it('passes the coordinate through to the Marker unchanged', () => {
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={null} />);
    expect(getMarkerProps().coordinate).toEqual(HOLDING_COORD);
  });

  it('flat={true} so rotation rotates on the map plane', () => {
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
    expect(getMarkerProps().flat).toBe(true);
  });

  it('rerendering with a new heading reuses the Marker (no remount)', () => {
    const { rerender, getByTestId } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={10} />,
    );
    const firstMarker = getByTestId('mock-marker');

    rerender(<UserLocationMarker coordinate={HOLDING_COORD} heading={45} />);
    const secondMarker = getByTestId('mock-marker');
    expect(secondMarker).toBe(firstMarker);
  });
});

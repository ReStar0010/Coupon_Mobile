/**
 * UserLocationMarker contract tests.
 *
 * Guards the iOS "marker jumps between center and top-left" bug.
 *
 * Root cause was `tracksViewChanges` defaulting to true while an inner
 * View carried a `transform: [{ rotate: ... }]` driven by heading. The
 * 10 Hz heading stream re-rasterised the marker bitmap on every tick,
 * and during re-rasterisation the marker briefly flashed at screen
 * (0,0) — the top-left — before snapping back to the correct lat/lng.
 *
 * Fix: use the Marker's native `rotation` prop (no JS re-rasterise) and
 * pin `tracksViewChanges={false}` so the bitmap is only rendered once.
 * Inner View must NOT carry a rotate transform.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

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

beforeEach(() => {
  (globalThis as Record<string, unknown>).__markerProps = undefined;
});

describe('UserLocationMarker', () => {
  it('passes heading to the Marker via the native `rotation` prop', () => {
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
    expect(getMarkerProps().rotation).toBe(42);
  });

  it('sets rotation to 0 when heading is null (no JS-side default that triggers re-render)', () => {
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={null} />);
    expect(getMarkerProps().rotation).toBe(0);
  });

  it('sets tracksViewChanges={false} so heading updates do NOT re-rasterise the marker', () => {
    // The "jumping" bug was caused by the default true tracksViewChanges
    // re-rasterising on every heading tick. Pin to false.
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
    expect(getMarkerProps().tracksViewChanges).toBe(false);
  });

  it('inner content has NO `transform: rotate` style (rotation is on the Marker, not the View)', () => {
    const { toJSON } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={42} />,
    );
    // The bug we're guarding: previously the inner View carried
    //   transform: [{ rotate: '<heading>deg' }]
    // which triggered the Marker bitmap to re-rasterise on every
    // heading tick. The whole render output under UserLocationMarker
    // must NOT contain any rotate transform at any depth.
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toMatch(/rotate/);
  });

  it('omits the heading-cone Path when heading is null', () => {
    const { queryByTestId } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={null} />,
    );
    // The cone Path is the only Path; the dot is a Circle.
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

  it('flat={true} so rotation rotates on the map plane (not facing the camera)', () => {
    render(<UserLocationMarker coordinate={HOLDING_COORD} heading={42} />);
    expect(getMarkerProps().flat).toBe(true);
  });

  it('rerendering with a new heading updates the Marker in place (no remount, no (0,0) flash)', () => {
    // Regression guard for the iOS jumping bug. A remount on heading
    // change would re-rasterise the bitmap and surface the (0,0) flash
    // again. We assert the Marker host stays in the tree across renders
    // and the new rotation propagates.
    const { rerender, getByTestId } = render(
      <UserLocationMarker coordinate={HOLDING_COORD} heading={10} />,
    );
    const firstMarker = getByTestId('mock-marker');
    expect(getMarkerProps().rotation).toBe(10);

    rerender(<UserLocationMarker coordinate={HOLDING_COORD} heading={45} />);
    const secondMarker = getByTestId('mock-marker');
    expect(getMarkerProps().rotation).toBe(45);
    // Same host element (React reused the node — no unmount/remount).
    expect(secondMarker).toBe(firstMarker);
  });
});

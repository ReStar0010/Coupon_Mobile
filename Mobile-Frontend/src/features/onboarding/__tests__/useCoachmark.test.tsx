import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockHasSeen = jest.fn<Promise<boolean>, [string]>();
const mockMarkSeen = jest.fn<Promise<void>, [string]>();
jest.mock('@/src/services/onboarding/onboardingState', () => ({
  hasSeenCoachmark: (s: string) => mockHasSeen(s),
  markCoachmarkSeen: (s: string) => mockMarkSeen(s),
}));

import { useCoachmark } from '../useCoachmark';

function Harness({ screen }: { screen: 'home' | 'map' }) {
  const { visible, step, next, done } = useCoachmark(screen);
  return (
    <>
      <Text testID="visible">{String(visible)}</Text>
      <Text testID="step">{String(step)}</Text>
      <Text testID="next" onPress={next}>next</Text>
      <Text testID="done" onPress={done}>done</Text>
    </>
  );
}

describe('useCoachmark', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkSeen.mockResolvedValue(undefined);
  });

  it('returns visible=false while the AsyncStorage check is in flight, then visible=true when unseen', async () => {
    mockHasSeen.mockResolvedValueOnce(false);
    const { getByTestId } = render(<Harness screen="home" />);
    // Pre-resolve: hook defaults to hidden so we never flash an overlay
    // on top of a normally-rendered screen.
    expect(getByTestId('visible').props.children).toBe('false');

    await waitFor(() => {
      expect(getByTestId('visible').props.children).toBe('true');
    });
    expect(getByTestId('step').props.children).toBe('0');
  });

  it('returns visible=false when the coach-mark has already been seen', async () => {
    mockHasSeen.mockResolvedValueOnce(true);
    const { getByTestId } = render(<Harness screen="map" />);
    // Settle the effect.
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByTestId('visible').props.children).toBe('false');
  });

  it('next() advances the step counter without writing to storage', async () => {
    mockHasSeen.mockResolvedValueOnce(false);
    const { getByTestId } = render(<Harness screen="home" />);
    await waitFor(() => expect(getByTestId('visible').props.children).toBe('true'));
    act(() => {
      getByTestId('next').props.onPress();
    });
    expect(getByTestId('step').props.children).toBe('1');
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it('done() hides the overlay and persists the per-screen flag', async () => {
    mockHasSeen.mockResolvedValueOnce(false);
    const { getByTestId } = render(<Harness screen="home" />);
    await waitFor(() => expect(getByTestId('visible').props.children).toBe('true'));
    await act(async () => {
      getByTestId('done').props.onPress();
    });
    expect(mockMarkSeen).toHaveBeenCalledWith('home');
    expect(getByTestId('visible').props.children).toBe('false');
  });
});

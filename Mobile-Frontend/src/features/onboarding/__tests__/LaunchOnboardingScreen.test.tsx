import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockMarkSeen = jest.fn<Promise<void>, []>();
jest.mock('@/src/services/onboarding/onboardingState', () => ({
  markLaunchOnboardingSeen: () => mockMarkSeen(),
}));

import LaunchOnboardingScreen from '../LaunchOnboardingScreen';

describe('LaunchOnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkSeen.mockResolvedValue(undefined);
  });

  it('renders all 3 onboarding pages', () => {
    const { getByTestId } = render(<LaunchOnboardingScreen onDone={jest.fn()} />);
    expect(getByTestId('onboarding-page-0')).toBeTruthy();
    expect(getByTestId('onboarding-page-1')).toBeTruthy();
    expect(getByTestId('onboarding-page-2')).toBeTruthy();
  });

  it('starts on page 0 — dots reflect current index', () => {
    const { getByTestId } = render(<LaunchOnboardingScreen onDone={jest.fn()} />);
    expect(getByTestId('onboarding-dot-0').props.accessibilityState?.selected).toBe(true);
    expect(getByTestId('onboarding-dot-1').props.accessibilityState?.selected).toBe(false);
  });

  it('next button advances pages and the last page shows "Start"', () => {
    const onDone = jest.fn();
    const { getByTestId, getByText } = render(<LaunchOnboardingScreen onDone={onDone} />);

    fireEvent.press(getByTestId('onboarding-next-btn'));
    expect(getByTestId('onboarding-dot-1').props.accessibilityState?.selected).toBe(true);

    fireEvent.press(getByTestId('onboarding-next-btn'));
    expect(getByTestId('onboarding-dot-2').props.accessibilityState?.selected).toBe(true);
    // Final page CTA renders Chinese "開始使用 CouPro".
    expect(getByText(/開始使用/)).toBeTruthy();
  });

  it('completing the flow marks it seen and calls onDone', async () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<LaunchOnboardingScreen onDone={onDone} />);

    fireEvent.press(getByTestId('onboarding-next-btn'));
    fireEvent.press(getByTestId('onboarding-next-btn'));
    // Final "Start" press.
    await fireEvent.press(getByTestId('onboarding-next-btn'));

    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skip button also marks it seen and calls onDone (no penalty for skipping)', async () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<LaunchOnboardingScreen onDone={onDone} />);

    await fireEvent.press(getByTestId('onboarding-skip-btn'));

    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

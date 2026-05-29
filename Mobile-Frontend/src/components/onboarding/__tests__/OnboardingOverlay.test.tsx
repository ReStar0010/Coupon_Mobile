import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OnboardingOverlay from '../OnboardingOverlay';

const noop = () => {};

describe('OnboardingOverlay', () => {
  it('renders nothing when no steps for screenKey', () => {
    const { queryByTestId } = render(
      <OnboardingOverlay screenKey={'home' as any} step={99} onNext={noop} onDone={noop} />
    );
    expect(queryByTestId('onboarding-overlay')).toBeNull();
  });

  it('renders tooltip with step text', () => {
    const { getByTestId, getByText } = render(
      <OnboardingOverlay screenKey="home" step={0} onNext={noop} onDone={noop} />
    );
    expect(getByTestId('onboarding-tooltip')).toBeTruthy();
    expect(getByText('歡迎使用 CouPro！這是你的優惠券錢包。')).toBeTruthy();
  });

  it('shows 下一步 on non-last step', () => {
    const { getByText } = render(
      <OnboardingOverlay screenKey="home" step={0} onNext={noop} onDone={noop} />
    );
    expect(getByText('下一步 →')).toBeTruthy();
  });

  it('shows 開始使用 on last step', () => {
    const { getByText } = render(
      // home has 5 steps, so last index = 4
      <OnboardingOverlay screenKey="home" step={4} onNext={noop} onDone={noop} />
    );
    expect(getByText('開始使用！')).toBeTruthy();
  });

  it('calls onNext when pressing next button on non-last step', () => {
    const onNext = jest.fn();
    const { getByTestId } = render(
      <OnboardingOverlay screenKey="home" step={0} onNext={onNext} onDone={noop} />
    );
    fireEvent.press(getByTestId('onboarding-next-btn'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onDone when pressing button on last step', () => {
    const onDone = jest.fn();
    const { getByTestId } = render(
      <OnboardingOverlay screenKey="home" step={4} onNext={noop} onDone={onDone} />
    );
    fireEvent.press(getByTestId('onboarding-next-btn'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('renders correct step count for spinner (5 steps)', () => {
    const { getByText } = render(
      <OnboardingOverlay screenKey="spinner" step={2} onNext={noop} onDone={noop} />
    );
    expect(getByText('3/5')).toBeTruthy();
  });

  it('shows coupon-detail step text', () => {
    const { getByText } = render(
      <OnboardingOverlay screenKey="coupon-detail" step={1} onNext={noop} onDone={noop} />
    );
    expect(getByText('按「立即使用」前往掃描店家 QR Code。')).toBeTruthy();
  });
});

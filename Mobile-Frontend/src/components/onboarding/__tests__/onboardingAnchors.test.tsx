import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  OnboardingAnchorProvider,
  OnboardingAnchor,
  useAnchorRegistry,
  ANCHOR,
} from '../onboardingAnchors';

/** Captures the registry instance exposed by the provider for assertions. */
function RegistryProbe({
  onReady,
}: {
  onReady: (reg: ReturnType<typeof useAnchorRegistry>) => void;
}): null {
  const registry = useAnchorRegistry();
  useEffect(() => {
    onReady(registry);
  }, [registry, onReady]);
  return null;
}

/** A fake host node whose measureInWindow resolves to a fixed rect. */
function fakeNode(x: number, y: number, w: number, h: number) {
  return { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(x, y, w, h) };
}

describe('onboardingAnchors registry', () => {
  it('measures a registered node back to its window rect', async () => {
    let registry: ReturnType<typeof useAnchorRegistry> = null;
    render(
      <OnboardingAnchorProvider>
        <RegistryProbe onReady={(r) => (registry = r)} />
      </OnboardingAnchorProvider>,
    );

    registry!.register('a', fakeNode(10, 20, 30, 40));
    await expect(registry!.measure('a')).resolves.toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it('resolves null for an unregistered id', async () => {
    let registry: ReturnType<typeof useAnchorRegistry> = null;
    render(
      <OnboardingAnchorProvider>
        <RegistryProbe onReady={(r) => (registry = r)} />
      </OnboardingAnchorProvider>,
    );

    await expect(registry!.measure('missing')).resolves.toBeNull();
  });

  it('treats a zero-size measurement as not-ready (null)', async () => {
    let registry: ReturnType<typeof useAnchorRegistry> = null;
    render(
      <OnboardingAnchorProvider>
        <RegistryProbe onReady={(r) => (registry = r)} />
      </OnboardingAnchorProvider>,
    );

    registry!.register('z', fakeNode(0, 0, 0, 0));
    await expect(registry!.measure('z')).resolves.toBeNull();
  });

  it('stops resolving a node after it is unregistered', async () => {
    let registry: ReturnType<typeof useAnchorRegistry> = null;
    render(
      <OnboardingAnchorProvider>
        <RegistryProbe onReady={(r) => (registry = r)} />
      </OnboardingAnchorProvider>,
    );

    registry!.register('a', fakeNode(1, 2, 3, 4));
    registry!.unregister('a');
    await expect(registry!.measure('a')).resolves.toBeNull();
  });

  it('returns null registry when used without a provider', () => {
    let registry: ReturnType<typeof useAnchorRegistry> = undefined as never;
    render(<RegistryProbe onReady={(r) => (registry = r)} />);
    expect(registry).toBeNull();
  });
});

describe('OnboardingAnchor', () => {
  it('renders children and forwards view props like testID', () => {
    const { getByTestId, getByText } = render(
      <OnboardingAnchorProvider>
        <OnboardingAnchor id={ANCHOR.homeWallet} testID="wallet-anchor">
          <Text>wallet</Text>
        </OnboardingAnchor>
      </OnboardingAnchorProvider>,
    );
    expect(getByTestId('wallet-anchor')).toBeTruthy();
    expect(getByText('wallet')).toBeTruthy();
  });

  it('renders its children even with no provider (no-op registration)', () => {
    const { getByText } = render(
      <OnboardingAnchor id="orphan">
        <Text>still here</Text>
      </OnboardingAnchor>,
    );
    expect(getByText('still here')).toBeTruthy();
  });
});

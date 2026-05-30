import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Anchor registry for the contextual coach-mark overlay.
 *
 * The overlay no longer hardcodes spotlight rectangles (those drifted off
 * target on any device that wasn't the one they were eyeballed on). Instead
 * each highlightable element wraps itself in <OnboardingAnchor id="...">,
 * registering its native node here. The overlay looks the node up by id and
 * measures its real on-screen rect via `measureInWindow`, so the spotlight
 * lands correctly on every screen size, inset, and dynamic layout.
 */

/** A measured rectangle in window coordinates (origin = top-left of window). */
export interface MeasuredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimal surface of a RN host node we rely on for measurement. */
interface Measurable {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
}

interface AnchorRegistry {
  register: (id: string, node: Measurable | null) => void;
  unregister: (id: string) => void;
  /** Resolves the node's window rect, or null if absent / not yet laid out. */
  measure: (id: string) => Promise<MeasuredRect | null>;
}

/**
 * Stable, screen-namespaced anchor ids shared between the overlay (which
 * references them in its step definitions) and the screens (which attach
 * them to real elements). Keeping them in one place prevents the two sides
 * drifting apart silently.
 */
export const ANCHOR = {
  homeWallet: 'home.wallet',
  homeBalance: 'home.balance',
  homeRedeem: 'home.redeem',
  homeGem: 'home.gem',
  homeCoupon: 'home.coupon',
  detailTicket: 'detail.ticket',
  detailUse: 'detail.use',
  detailShare: 'detail.share',
  spinnerWheel: 'spinner.wheel',
  spinnerBet: 'spinner.bet',
  spinnerInvite: 'spinner.invite',
  spinnerSlots: 'spinner.slots',
  spinnerSpin: 'spinner.spin',
  shareReward: 'share.reward',
  shareNote: 'share.note',
  shareTarget: 'share.target',
  shareConfirm: 'share.confirm',
  settingsProfile: 'settings.profile',
  mapSearch: 'map.search',
} as const;

const AnchorContext = createContext<AnchorRegistry | null>(null);

/**
 * Wrap the app (above every coach-marked screen and its <Coachmark>) so
 * anchors and the overlay share one registry. Holds nodes in a ref — the
 * registry identity is stable, so registering an anchor never re-renders
 * the provider's subtree.
 */
export function OnboardingAnchorProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const nodes = useRef<Map<string, Measurable>>(new Map());

  const register = useCallback((id: string, node: Measurable | null): void => {
    if (node) {
      nodes.current.set(id, node);
    } else {
      nodes.current.delete(id);
    }
  }, []);

  const unregister = useCallback((id: string): void => {
    nodes.current.delete(id);
  }, []);

  const measure = useCallback((id: string): Promise<MeasuredRect | null> => {
    const node = nodes.current.get(id);
    if (!node) return Promise.resolve(null);
    return new Promise((resolve) => {
      // measureInWindow can fire with all-zeros before the node is laid out;
      // treat a zero-size result as "not ready" so the overlay retries.
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 && height <= 0) resolve(null);
        else resolve({ x, y, width, height });
      });
    });
  }, []);

  const value = useMemo<AnchorRegistry>(
    () => ({ register, unregister, measure }),
    [register, unregister, measure],
  );

  return <AnchorContext.Provider value={value}>{children}</AnchorContext.Provider>;
}

/** Returns the registry, or null when rendered outside a provider (e.g. unit tests). */
export function useAnchorRegistry(): AnchorRegistry | null {
  return useContext(AnchorContext);
}

interface OnboardingAnchorProps extends ViewProps {
  id: string;
  children: React.ReactNode;
}

/**
 * Transparent wrapper that registers its native node under `id`. Renders a
 * plain View (with `collapsable={false}` so Android keeps it measurable) and
 * forwards `style`/other View props, so callers can pass `style={{ flex: 1 }}`
 * for flex children and avoid disturbing the surrounding layout.
 */
export function OnboardingAnchor({
  id,
  children,
  ...viewProps
}: OnboardingAnchorProps): React.JSX.Element {
  const registry = useAnchorRegistry();
  const ref = useRef<View>(null);

  useEffect(() => {
    registry?.register(id, ref.current);
    return () => registry?.unregister(id);
  }, [id, registry]);

  return (
    <View ref={ref} collapsable={false} {...viewProps}>
      {children}
    </View>
  );
}

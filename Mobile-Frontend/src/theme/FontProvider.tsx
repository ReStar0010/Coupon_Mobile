import React from 'react';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts as useSpaceGrotesk,
} from '@expo-google-fonts/space-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  useFonts as useJetBrainsMono,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';

// NOTE: preventAutoHideAsync() lives in app/_layout.tsx only. Calling it
// here as well caused expo-splash-screen to fail the second registration
// silently, and the subsequent hideAsync() in this file's useEffect would
// reject with "No native splash screen registered for given view
// controller." Keeping the call site single-sourced is the documented fix.

interface FontProviderProps {
  children: React.ReactNode;
}

// Render the app immediately and let custom fonts swap in when they load
// (FOUT, not FOIT). Blocking the entire tree on font download holds the
// native splash for 3–5 s on cold launches, which was the dominant cost of
// "login page takes 5 s to appear". The brief swap from system → brand font
// is acceptable on the auth screens, and on subsequent launches the fonts
// are cached so the swap is imperceptible.
export default function FontProvider({ children }: FontProviderProps): React.JSX.Element {
  // Kick off font loading but don't block render on it. React Native's font
  // registry is consulted on every Text render — any screen that mounts after
  // fonts finish loading will use the brand font; screens already on-screen
  // when the swap completes keep their fallback until their next re-render.
  // That's the right trade-off for an auth screen: faster paint matters more
  // than a tiny FOUT flicker on the very first cold launch.
  useSpaceGrotesk({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  useJetBrainsMono({
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
  });

  // Hide the native splash on first mount so the React tree paints right
  // away rather than waiting for the font network/disk fetch.
  React.useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return <>{children}</>;
}

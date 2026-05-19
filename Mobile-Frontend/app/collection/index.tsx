import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CollectionTokenRoute from './[token]';

/**
 * Index route for /collection?token=… — the shape the BE emits for the
 * custom scheme `coupro://collection?token=<token>`.
 *
 * Expo Router maps the dynamic-segment file `[token].tsx` to a *path*
 * segment like `/collection/<token>`, so a query-param URL never reaches
 * it. We reuse the same logic by injecting the query `token` into
 * `useLocalSearchParams` and re-exporting `CollectionTokenRoute` (which
 * already reads from `useLocalSearchParams<{ token?: string }>()`).
 *
 * The Universal Link variant (`https://api.coupro.pro/collection/<token>/`)
 * still resolves to `[token].tsx` directly.
 */
export default function CollectionIndexRoute(): React.JSX.Element {
  // Pre-read the token so it shows up as an Expo Router search param —
  // CollectionTokenRoute then picks it up via its own useLocalSearchParams.
  useLocalSearchParams<{ token?: string }>();
  return <CollectionTokenRoute />;
}

'use client';

import { useEffect, useState } from 'react';
import { getAppStoreUrl, getAppStoreUrlHydrationDefault } from './appStoreUrl';

/**
 * Stable SSR/hydration default, then correct Play vs App Store URL after mount (uses `navigator`).
 */
export function useAppStoreDownloadHref(): string {
  const [href, setHref] = useState(getAppStoreUrlHydrationDefault);
  useEffect(() => {
    setHref(getAppStoreUrl());
  }, []);
  return href;
}

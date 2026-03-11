let isCollectionDirty = false;

/**
 * Mark the collection tab as needing a refresh.
 * Used to invalidate preserved tab state after actions that change `/exclusive-coupons/` results.
 */
export function markCollectionDirty(): void {
  isCollectionDirty = true;
}

/**
 * Consume the dirty flag. Returns true only once per mark.
 */
export function consumeCollectionDirty(): boolean {
  if (!isCollectionDirty) return false;
  isCollectionDirty = false;
  return true;
}

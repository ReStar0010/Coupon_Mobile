/**
 * useEULACheck Hook
 * UGC Compliance (Apple Guideline 1.2) - User Story 3
 *
 * Hook to check EULA acceptance status and show modal if needed.
 * Usage: Call before any content upload action.
 */

import { useState, useCallback } from 'react';
import { getEULAStatus } from '../../services/eulaAPI';

interface UseEULACheckResult {
  checkEULA: () => Promise<boolean>;
  eulaModalVisible: boolean;
  showEULAModal: () => void;
  hideEULAModal: () => void;
  onEULAAccepted: () => void;
}

/**
 * Hook to manage EULA acceptance flow
 * @returns Object with EULA checking functions and modal state
 */
export function useEULACheck(): UseEULACheckResult {
  const [eulaModalVisible, setEulaModalVisible] = useState(false);
  const [eulaCheckResolve, setEulaCheckResolve] = useState<((accepted: boolean) => void) | null>(
    null
  );

  /**
   * Check if user needs to accept EULA
   * Returns true if EULA is accepted or user accepts in modal
   * Returns false if user cancels
   */
  const checkEULA = useCallback(async (): Promise<boolean> => {
    try {
      const status = await getEULAStatus();

      if (!status.needs_acceptance) {
        // Already accepted current version
        return true;
      }

      // Need to accept EULA - show modal and wait for user action
      return new Promise<boolean>((resolve) => {
        setEulaCheckResolve(() => resolve);
        setEulaModalVisible(true);
      });
    } catch (error) {
      console.error('Failed to check EULA status:', error);
      // On error, show modal to be safe (assume EULA needed)
      return new Promise<boolean>((resolve) => {
        setEulaCheckResolve(() => resolve);
        setEulaModalVisible(true);
      });
    }
  }, []);

  const showEULAModal = useCallback(() => {
    setEulaModalVisible(true);
  }, []);

  const hideEULAModal = useCallback(() => {
    setEulaModalVisible(false);
    // If user closes without accepting, resolve as false
    if (eulaCheckResolve) {
      eulaCheckResolve(false);
      setEulaCheckResolve(null);
    }
  }, [eulaCheckResolve]);

  const onEULAAccepted = useCallback(() => {
    setEulaModalVisible(false);
    // Resolve promise with true (accepted)
    if (eulaCheckResolve) {
      eulaCheckResolve(true);
      setEulaCheckResolve(null);
    }
  }, [eulaCheckResolve]);

  return {
    checkEULA,
    eulaModalVisible,
    showEULAModal,
    hideEULAModal,
    onEULAAccepted,
  };
}


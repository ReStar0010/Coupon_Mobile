import { isAxiosError } from 'axios';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Hook that converts a caught API error into a localised zh-TW string.
 *
 * Works with errors thrown by fetchAPI (AxiosError with .errorCode / .errorContext
 * augmentation added in authAPI.ts) as well as plain network errors.
 *
 * Usage:
 *   const { getErrorMessage } = useApiError();
 *   // inside catch:
 *   Toast.show({ type: 'failRed', text1: getErrorMessage(error) });
 *
 * Note: Sentry reporting is handled upstream in fetchAPI — this hook only
 * handles translation. Do not add captureException here to avoid double-reporting.
 */
export function useApiError() {
  const { t } = useTranslation();

  const getErrorMessage = useCallback(
    (error: unknown): string => {
      if (isAxiosError(error)) {
        const code = error.errorCode ?? 'GENERIC_ERROR';
        const ctx = error.errorContext ?? {};
        return t(`errors.${code}`, {
          ...ctx,
          defaultValue: t('errors.GENERIC_ERROR'),
        });
      }

      // Non-axios errors (network failures, permission issues, etc.)
      return t('errors.NETWORK_ERROR');
    },
    [t],
  );

  return { getErrorMessage };
}

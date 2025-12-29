import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { DailyDrawResult, DrawTemplate } from '../utils/types';
import { checkLastDrawDate } from '../utils/couponUtils';
import { devDebug } from '../../utils/devLogger';
import { fetchAPI } from '../../utils/authAPI';

interface UseDailyDrawReturn {
  showDailyDraw: boolean;
  setShowDailyDraw: (show: boolean) => void;
  dailyDrawResult: DailyDrawResult | null;
  isDailyDrawLoading: boolean;
  hasDailyDrawn: boolean;
  availableTemplates: DrawTemplate[];
  handleDailyDraw: () => Promise<void>;
  resetDailyDrawUI: () => void;
  closeDailyDrawWithSuccess: () => void;
}

export function useDailyDraw(
  isAuthenticated: boolean,
  authLoading: boolean,
  onDrawSuccess: () => void
): UseDailyDrawReturn {
  const [showDailyDraw, setShowDailyDraw] = useState(false);
  const [dailyDrawResult, setDailyDrawResult] = useState<DailyDrawResult | null>(null);
  const [isDailyDrawLoading, setIsDailyDrawLoading] = useState(false);
  const [hasDailyDrawn, setHasDailyDrawn] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<DrawTemplate[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkDrawStatus = useCallback(async () => {
    if (!isAuthenticated || authLoading) return;

    try {
      const hasDrawn = await checkLastDrawDate();
      if (isMountedRef.current) {
        setHasDailyDrawn(hasDrawn);
      }
    } catch (error) {
      console.error('Error checking draw status:', error);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    checkDrawStatus();
  }, [checkDrawStatus]);

  const fetchAvailableTemplates = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetchAPI('/daily-draw-templates/', {
        method: 'GET',
        withCredentials: true,
      });

      if (isMountedRef.current) {
        setAvailableTemplates(response.data.active_templates);
        devDebug('Available templates:', response.data.active_templates);
      }
    } catch (err) {
      console.error('Error fetching available templates:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (showDailyDraw && isAuthenticated) {
      fetchAvailableTemplates();
    }
  }, [showDailyDraw, isAuthenticated, fetchAvailableTemplates]);

  const selectRandomTemplate = useCallback(
    (templates: DrawTemplate[]): DrawTemplate | null => {
      if (!templates || templates.length === 0) return null;
      const randomIndex = Math.floor(Math.random() * templates.length);
      return templates[randomIndex];
    },
    []
  );

  const getErrorMessage = useCallback((err: unknown): string => {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 400) {
        return err.response.data.message || '抽獎失敗，請稍後再試。';
      }
      if (err.response?.data?.error) {
        return err.response.data.error;
      }
    }
    if (err instanceof Error) {
      return err.message;
    }
    return '抽獎失敗，請稍後再試。';
  }, []);

  const handleDailyDraw = useCallback(async () => {
    setIsDailyDrawLoading(true);

    try {
      const selectedTemplate = selectRandomTemplate(availableTemplates);

      if (!selectedTemplate) {
        throw new Error('沒有可用的優惠券模板');
      }

      devDebug('Selected template for draw:', selectedTemplate);

      const response = await fetchAPI('/coupon/daily-draw/', {
        method: 'POST',
        withCredentials: true,
        data: { template_id: selectedTemplate.id },
      });

      devDebug('Daily draw result:', response.data);

      if (isMountedRef.current) {
        setDailyDrawResult({
          success: response.data.success,
          coupon: response.data.success
            ? {
                id: response.data.coupon.id,
                name: response.data.coupon.name,
              }
            : undefined,
          message: response.data.message,
        });
        setHasDailyDrawn(true);
      }
    } catch (err) {
      console.error('Error during daily draw:', err);

      if (axios.isAxiosError(err) && err.response?.status === 400) {
        if (isMountedRef.current) {
          setHasDailyDrawn(true);
        }
      }

      if (isMountedRef.current) {
        setDailyDrawResult({
          success: false,
          message: getErrorMessage(err),
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsDailyDrawLoading(false);
      }
    }
  }, [availableTemplates, selectRandomTemplate, getErrorMessage]);

  const resetDailyDrawUI = useCallback(() => {
    setShowDailyDraw(false);
    setDailyDrawResult(null);
  }, []);

  const closeDailyDrawWithSuccess = useCallback(() => {
    setShowDailyDraw(false);
    setDailyDrawResult(null);
    if (dailyDrawResult?.success) {
      onDrawSuccess();
    }
  }, [dailyDrawResult?.success, onDrawSuccess]);

  return {
    showDailyDraw,
    setShowDailyDraw,
    dailyDrawResult,
    isDailyDrawLoading,
    hasDailyDrawn,
    availableTemplates,
    handleDailyDraw,
    resetDailyDrawUI,
    closeDailyDrawWithSuccess,
  };
}

export default useDailyDraw;

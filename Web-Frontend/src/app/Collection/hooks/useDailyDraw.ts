// Custom hook for managing daily draws
import { useState, useEffect } from 'react';
import axios from 'axios';
import { DailyDrawResult, DrawTemplate } from '@/app/Collection/utils/types';
import { checkLastDrawDate } from '@/app/Collection/utils/couponUtils';
import { devDebug } from '@/app/utils/devLogger';
import { fetchAPI } from '@/app/utils/authAPI';

export function useDailyDraw(isAuthenticated: boolean, authLoading: boolean, onDrawSuccess: () => void) {
  const [showDailyDraw, setShowDailyDraw] = useState(false);
  const [dailyDrawResult, setDailyDrawResult] = useState<DailyDrawResult | null>(null);
  const [isDailyDrawLoading, setIsDailyDrawLoading] = useState(false);
  const [hasDailyDrawn, setHasDailyDrawn] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<DrawTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check if user has already drawn today
  useEffect(() => {
    const checkDrawStatus = async () => {
      if (isAuthenticated && !authLoading) {
        const hasDrawn = await checkLastDrawDate();
        setHasDailyDrawn(hasDrawn);
      }
    };
    
    checkDrawStatus();
  }, [isAuthenticated, authLoading]);

  // Fetch available draw templates when the daily draw modal opens
  const fetchAvailableTemplates = async () => {
    try {

      const response = await fetchAPI('/daily-draw-templates/',{method: 'GET', withCredentials: true})

      setAvailableTemplates(response.data.active_templates);
      devDebug("Available templates:", response.data.active_templates);
    } catch (err) {
      console.error("Error fetching available templates:", err);
      setError("無法載入抽獎模板，請稍後再試");
    }
  };

  // Fetch templates when the daily draw modal opens
  useEffect(() => {
    if (showDailyDraw && isAuthenticated) {
      fetchAvailableTemplates();
    }
  }, [showDailyDraw, isAuthenticated]);

  // Handle daily draw
  const handleDailyDraw = async () => {
    setIsDailyDrawLoading(true);
    try {
      // Check if templates are available
      if (!availableTemplates || availableTemplates.length === 0) {
        throw new Error("沒有可用的優惠券模板");
      }

      // Select a random template from available ones
      const randomIndex = Math.floor(Math.random() * availableTemplates.length);
      const selectedTemplate = availableTemplates[randomIndex];

      devDebug("Selected template for draw:", selectedTemplate);
 
      const response = await fetchAPI('/coupon/daily-draw/', {
        method: 'POST', 
        withCredentials: true,
        data: { template_id: selectedTemplate.id }
      });

      devDebug("Daily draw result:", response.data);

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
    } catch (err) {
      console.error("Error during daily draw:", err);
      let errorMessage = "抽獎失敗，請稍後再試。";
      setError(errorMessage);

      if (axios.isAxiosError(err)) {
        if (err.response?.status === 400) {
          // If the user has already drawn today
          errorMessage = err.response.data.message || errorMessage;
          setHasDailyDrawn(true);
        } else if (err.response?.data?.error) {
          errorMessage = err.response.data.error;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setDailyDrawResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsDailyDrawLoading(false);
    }
  };

  const resetDailyDrawUI = () => {
    setShowDailyDraw(false);
    setDailyDrawResult(null);
  };

  const closeDailyDrawWithSuccess = () => {
    setShowDailyDraw(false);
    setDailyDrawResult(null);
    if (dailyDrawResult?.success) {
      onDrawSuccess(); // Call the callback to refresh coupons
    }
  };

  return {
    showDailyDraw,
    setShowDailyDraw,
    dailyDrawResult,
    isDailyDrawLoading,
    hasDailyDrawn,
    availableTemplates,
    error,
    handleDailyDraw,
    resetDailyDrawUI,
    closeDailyDrawWithSuccess
  };
}

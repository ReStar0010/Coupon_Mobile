import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useToast } from '@/app/components/providers/ToastProvider';
import { devDebug } from '@/app/utils/devLogger';
import { fetchAPI, AuthenticationError } from '@/app/utils/authAPI';

export interface StatisticsData {
  couponsUsedCount: number;
  totalSavings: number;
  monthlySavings: number;
  hasGoal: boolean;
  savingsGoalName: string;
  savingsGoalAmount: number;
  savingsGoalImage: string;
  goalProgress: number;
  goalAchieved: boolean;
}

export interface CompletedGoal {
  name: string;
  amount: number;
  image: string;
  completedDate: string;
}

interface UseStatisticsDataReturn {
  stats: StatisticsData;
  completedGoals: CompletedGoal[];
  isLoading: boolean;
  error: string | null;
  resetGoal: () => Promise<void>;
  setSavingsGoal: (goalName: string, goalAmount: number, goalImage: string) => Promise<void>;
  fetchUserStats: () => Promise<void>;
}

const INITIAL_STATS: StatisticsData = {
  couponsUsedCount: 0,
  totalSavings: 0,
  monthlySavings: 0,
  hasGoal: false,
  savingsGoalName: '',
  savingsGoalAmount: 0,
  savingsGoalImage: '',
  goalProgress: 0,
  goalAchieved: false,
};

export const useStatisticsData = (isAuthenticated: boolean): UseStatisticsDataReturn => {
  const { showToast } = useToast();
  const router = useRouter();
  const [stats, setStats] = useState<StatisticsData>(INITIAL_STATS);
  const [completedGoals, setCompletedGoals] = useState<CompletedGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchCompletedGoals = useCallback(async () => {
    try {
      const response = await fetchAPI('/completed-goals/', {
        method: 'GET',
        withCredentials: true,
      });

      devDebug('Completed goals response:', response.data);

      if (isMountedRef.current && response.data && Array.isArray(response.data)) {
        setCompletedGoals(response.data);
      }
    } catch (err) {
      // Check if it's an authentication error
      if (err instanceof AuthenticationError || (axios.isAxiosError(err) && err.response?.status === 401)) {
        devDebug('Authentication error in fetchCompletedGoals, redirecting to login');
        if (isMountedRef.current) {
          router.replace('/(auth)/login');
        }
        return;
      }
      console.error('Error fetching completed goals:', err);
    }
  }, [router]);

  const fetchUserStats = useCallback(async () => {
    if (!isAuthenticated) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchAPI('/user-statistics/', {
        method: 'GET',
        withCredentials: true,
        signal: abortControllerRef.current.signal,
      });

      if (!isMountedRef.current) return;

      setStats({
        couponsUsedCount: response.data.coupons_used_count || 0,
        totalSavings: response.data.total_savings || 0,
        monthlySavings: response.data.monthly_savings || 0,
        hasGoal: response.data.has_goal || false,
        savingsGoalName: response.data.savings_goal_name || '',
        savingsGoalAmount: response.data.savings_goal_amount || 0,
        savingsGoalImage: response.data.savings_goal_image || '',
        goalProgress: response.data.goal_progress || 0,
        goalAchieved: response.data.goal_achieved || false,
      });

      await fetchCompletedGoals();
    } catch (err) {
      if (axios.isCancel(err)) {
        devDebug('Request cancelled');
        return;
      }
      
      // Check if it's an authentication error
      if (err instanceof AuthenticationError || (axios.isAxiosError(err) && err.response?.status === 401)) {
        devDebug('Authentication error detected, redirecting to login');
        if (isMountedRef.current) {
          // Redirect to login immediately
          router.replace('/(auth)/login');
        }
        return;
      }
      
      console.error('Error fetching user statistics:', err);
      if (isMountedRef.current) {
        setError('Failed to load your statistics. Please try again later.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, fetchCompletedGoals]);

  const setSavingsGoal = useCallback(
    async (goalName: string, goalAmount: number, goalImage: string) => {
      try {
        const response = await fetchAPI('/set-savings-goal/', {
          method: 'POST',
          withCredentials: true,
          data: JSON.stringify({
            goal_name: goalName,
            goal_amount: goalAmount,
            goal_image: goalImage,
          }),
        });

        showToast('儲蓄目標已設定', 'success');

        if (isMountedRef.current) {
          setStats((prev) => ({
            ...prev,
            hasGoal: true,
            savingsGoalName: goalName,
            savingsGoalAmount: goalAmount,
            savingsGoalImage: goalImage,
            monthlySavings: 0,
            goalProgress: 0,
            goalAchieved: false,
          }));
        }

        if (response.data.previous_goal_achieved) {
          await fetchCompletedGoals();
        }
      } catch (err) {
        console.error('Error setting savings goal:', err);
        showToast('設定儲蓄目標失敗', 'error');
      }

      await fetchUserStats();
    },
    [showToast, fetchCompletedGoals, fetchUserStats]
  );

  const resetGoal = useCallback(async () => {
    try {
      if (stats.goalAchieved && stats.hasGoal) {
        await fetchAPI('/add-completed-goal/', {
          method: 'POST',
          withCredentials: true,
          data: JSON.stringify({
            goal_name: stats.savingsGoalName,
            goal_amount: stats.savingsGoalAmount,
            goal_image: stats.savingsGoalImage,
          }),
        });

        const newCompletedGoal: CompletedGoal = {
          name: stats.savingsGoalName,
          amount: stats.savingsGoalAmount,
          image: stats.savingsGoalImage,
          completedDate: new Date().toISOString(),
        };

        if (isMountedRef.current) {
          setCompletedGoals((prev) => [...prev, newCompletedGoal]);
        }
      }

      await fetchAPI('/reset-savings-goal/', {
        method: 'POST',
        withCredentials: true,
      });

      if (isMountedRef.current) {
        setStats((prev) => ({
          ...prev,
          hasGoal: false,
          savingsGoalName: '',
          savingsGoalAmount: 0,
          savingsGoalImage: '',
          goalProgress: 0,
          goalAchieved: false,
        }));
      }

      showToast('儲蓄目標已重置', 'success');
    } catch (err) {
      console.error('Error resetting savings goal:', err);
      showToast('重置儲蓄目標失敗', 'error');
    }
  }, [stats, showToast]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserStats();
    }
  }, [isAuthenticated, fetchUserStats]);

  return {
    stats,
    completedGoals,
    isLoading,
    error,
    resetGoal,
    setSavingsGoal,
    fetchUserStats,
  };
};

export default useStatisticsData;

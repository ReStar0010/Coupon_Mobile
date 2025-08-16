import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../components/providers/ToastProvider';
import { devDebug } from '../../utils/devLogger';
import { fetchAPI } from '../../utils/authAPI';

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

export const useStatisticsData = (isAuthenticated: boolean) => {
  const { showToast } = useToast();

  // Stats state
  const [stats, setStats] = useState<StatisticsData>({
    couponsUsedCount: 0,
    totalSavings: 0,
    monthlySavings: 0,
    hasGoal: false,
    savingsGoalName: '',
    savingsGoalAmount: 0,
    savingsGoalImage: '',
    goalProgress: 0,
    goalAchieved: false,
  });

  // Completed goals state
  const [completedGoals, setCompletedGoals] = useState<CompletedGoal[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch completed goals
  const fetchCompletedGoals = async () => {
    try {
      const response = await fetchAPI('/completed-goals/', {
        method: 'GET',
        withCredentials: true,
      });

      devDebug('Completed goals response:', response.data);

      if (response.data && Array.isArray(response.data)) {
        setCompletedGoals(response.data);
      }
    } catch (err) {
      console.error('Error fetching completed goals:', err);
      // We don't set an error state here to not disrupt the main UI
    }
  };

  // Fetch user statistics
  const fetchUserStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchAPI('/user-statistics/', {
        method: 'GET',
        withCredentials: true,
      });

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

      // Also fetch completed goals
      fetchCompletedGoals();

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching user statistics:', err);
      setError('Failed to load your statistics. Please try again later.');
      setIsLoading(false);
    }
  };

  // Set savings goal
  const setSavingsGoal = async (goalName: string, goalAmount: number, goalImage: string) => {
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

      // Update local state with reset monthly savings
      setStats((prev) => ({
        ...prev,
        hasGoal: true,
        savingsGoalName: goalName,
        savingsGoalAmount: goalAmount,
        savingsGoalImage: goalImage,
        // Use 0 for monthly savings as we're resetting progress
        monthlySavings: 0,
        goalProgress: 0,
        goalAchieved: false,
      }));

      // If the previous goal was achieved, add it to completed goals
      if (response.data.previous_goal_achieved) {
        // Refresh completed goals list to show the new badge
        fetchCompletedGoals();
      }
    } catch (err) {
      console.error('Error setting savings goal:', err);
      showToast('設定儲蓄目標失敗', 'error');
    }

    fetchUserStats();
  };

  // Reset savings goal
  const resetGoal = async () => {
    try {
      // If current goal was achieved, add it to completed goals
      if (stats.goalAchieved && stats.hasGoal) {
        fetchAPI('/add-completed-goal/', {
          method: 'POST',
          withCredentials: true,
          data: JSON.stringify({
            goal_name: stats.savingsGoalName,
            goal_amount: stats.savingsGoalAmount,
            goal_image: stats.savingsGoalImage,
          }),
        });

        // Add to local state immediately for better UX
        const newCompletedGoal = {
          name: stats.savingsGoalName,
          amount: stats.savingsGoalAmount,
          image: stats.savingsGoalImage,
          completedDate: new Date().toISOString(),
        };

        setCompletedGoals((prev) => [...prev, newCompletedGoal]);
      }

      // Reset the goal
      await fetchAPI('/reset-savings-goal/', { method: 'POST', withCredentials: true });

      // Update local state to clear the goal
      setStats((prev) => ({
        ...prev,
        hasGoal: false,
        savingsGoalName: '',
        savingsGoalAmount: 0,
        savingsGoalImage: '',
        goalProgress: 0,
        goalAchieved: false,
      }));

      showToast('儲蓄目標已重置', 'success');
    } catch (err) {
      console.error('Error resetting savings goal:', err);
      showToast('重置儲蓄目標失敗', 'error');
    }
  };

  // Effect to fetch user stats on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // fetchUserStats intentionally omitted

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

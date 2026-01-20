import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { fetchAPI, AuthenticationError } from '../../utils/authAPI';

export interface TransactionHistoryItem {
  redemption_id: number;
  coupon_id: number;
  store_name: string;
  used_date: string;
}

export const useTransactionHistory = (isAuthenticated: boolean, limit: number = 2) => {
  const router = useRouter();
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transaction history
  const fetchTransactionHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchAPI('/coupon-history/', {
        method: 'GET',
        withCredentials: true,
      });

      const history = response.data.history || [];
      // Get the most recent items based on limit (0 means no limit)
      if (limit > 0) {
        setTransactionHistory(history.slice(0, limit));
      } else {
        setTransactionHistory(history);
      }
      setIsLoading(false);
    } catch (err) {
      // Check if it's an authentication error
      if (err instanceof AuthenticationError || (axios.isAxiosError(err) && err.response?.status === 401)) {
        console.error('Authentication error fetching transaction history, redirecting to login');
        // Redirect to login immediately
        router.replace('/Login');
        setIsLoading(false);
        return;
      }
      
      console.error('Error fetching transaction history:', err);
      setError('Failed to load transaction history');
      setIsLoading(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date
        .getHours()
        .toString()
        .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return dateString;
    }
  };

  // Effect to fetch transaction history on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactionHistory();
    }
  }, [isAuthenticated]);

  return {
    transactionHistory,
    isLoading,
    error,
    formatDate,
    refetch: fetchTransactionHistory,
  };
};

export default useTransactionHistory;

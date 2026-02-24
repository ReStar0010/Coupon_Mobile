import '../global.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ensureValidAuth } from './utils/authAPI';

export default function App() {
  const router = useRouter();
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Proactively validate and refresh tokens on app startup
        // This ensures we have a valid access token before navigating
        const hasValidAuth = await ensureValidAuth();

        if (hasValidAuth) {
          router.replace('/(tabs)/easyuse');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        router.replace('/(auth)/login');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
}

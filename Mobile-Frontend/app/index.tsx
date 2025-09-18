import '../global.css';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isUserLoggedIn } from './utils/authAPI';

export default function App() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check login status using the centralized auth function
    const checkLoginStatus = async () => {
      try {
        const loggedIn = await isUserLoggedIn();
        if (loggedIn) {
          router.replace('/Login');
        } else {
          router.replace('/EasyUse');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
        // If there's an error, default to login page
        router.replace('/Login');
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);
}

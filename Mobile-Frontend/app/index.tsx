import '../global.css';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isUserLoggedIn } from './utils/authAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check login status using the centralized auth function
    const checkLoginStatus = async () => {
      try {
        // TEMPORARY: Clear storage to force login page
        // Comment out these lines once you want to persist login
        await AsyncStorage.clear();
        console.log('AsyncStorage cleared - forcing login');
        
        const loggedIn = await isUserLoggedIn();
        if (loggedIn) {
          router.replace('/EasyUse');
        } else {
          router.replace('/Login');
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

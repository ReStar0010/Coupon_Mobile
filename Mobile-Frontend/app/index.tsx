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

    const checkLoginStatus = async () => {
      try {
 
        const loggedIn = await isUserLoggedIn();
        if (loggedIn) {
          router.replace('/EasyUse');
        } else {
          router.replace('/Login');
        }

      } catch (error) {

        console.error('Error checking login status:', error);
        router.replace('/Login');

      } finally {

        setIsLoading(false);

      }
    };

    checkLoginStatus();
  }, []);
}

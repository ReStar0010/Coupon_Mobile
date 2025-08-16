import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import UserInfoElement from '../../components/UserInfoElement';
import { fetchAPI } from '../../utils/authAPI';

export type UserDataPanelType = {
  className?: string;
};

// User data interface
interface UserData {
  id: number;
  email: string;
  date_joined: string;
  verified: boolean;
  is_merchant: boolean;
}

const UserDataPanel: React.FC<UserDataPanelType> = ({ className = '' }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        const response = await fetchAPI('/user-info/', {
          method: 'GET',
          withCredentials: true,
        });

        setUserData(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('無法載入用戶資料，請稍後再試。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '無日期資料';
    try {
      // Parse the ISO date string
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) return '無效日期';

      // Get UTC components to avoid timezone issues
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');

      return `${year}/${month}/${day}`;
    } catch (e) {
      return '無日期資料';
    }
  };

  return (
    <View
      className={`bg-bg-white ml-[27px] box-border flex max-w-full flex-row items-start justify-start self-stretch rounded-xl pb-[29px] pl-[30px] pr-[29px] pt-[31px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] ${className}`}>
      <View className="flex flex-1 flex-col items-start justify-start" style={{ gap: 16 }}>
        {isLoading ? (
          <View className="flex w-full flex-row items-center justify-center py-4">
            <ActivityIndicator size="large" color="#FFAD31" />
            <Text className="ml-3 text-gray-500">載入中...</Text>
          </View>
        ) : error ? (
          <View className="w-full py-4">
            <Text className="text-center text-red-500">{error}</Text>
          </View>
        ) : (
          <>
            <UserInfoElement
              contentGap={23}
              prop="帳號"
              userIconsMinWidth={32}
              content={userData?.email || '無資料'}
              userAvatarsDisplay="none"
            />
            <UserInfoElement
              contentGap={20}
              prop="註冊日期"
              userIconsMinWidth={64}
              content={formatDate(userData?.date_joined)}
              userAvatarsDisplay="flex"
              userAvatarsMinWidth={94}
              lastElement={true}
            />
          </>
        )}
      </View>
    </View>
  );
};

export default UserDataPanel;

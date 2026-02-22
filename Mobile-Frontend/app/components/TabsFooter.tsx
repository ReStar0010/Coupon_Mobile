import React, { useRef, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { XStack } from 'tamagui';
import { Home, StretchHorizontal, BarChart2 } from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadow } from 'react-native-shadow-2';

interface TabsFooterProps {
  activeTab?: 'home' | 'collection' | 'statistics';
  onHomePress?: () => void;
  onCollectionPress?: () => void;
  onStatisticsPress?: () => void;
}

const TabsFooter: React.FC<TabsFooterProps> = ({
  activeTab = 'home',
  onHomePress,
  onCollectionPress,
  onStatisticsPress,
}) => {
  const insets = useSafeAreaInsets();
  const navigatingTabRef = useRef<string | null>(null);
  const lastClickRef = useRef({ tab: '', time: 0 });

  useEffect(() => {
    if (activeTab === navigatingTabRef.current) {
      navigatingTabRef.current = null;
    }
  }, [activeTab]);

  const getIconColor = (tabName: string) => (activeTab === tabName ? '#ffad31' : '#a8a8a8');

  const handleTabPress = (tab: 'home' | 'collection' | 'statistics', onPress?: () => void) => {
    const now = Date.now();
    const isNavigating = navigatingTabRef.current === tab;
    const isActive = activeTab === tab;
    const isRecentClick = lastClickRef.current.tab === tab && now - lastClickRef.current.time < 500;

    if (!isActive && !isNavigating && !isRecentClick && onPress) {
      navigatingTabRef.current = tab;
      lastClickRef.current = { tab, time: now };
      onPress();
    }
  };

  return (
    <XStack
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 20,
        paddingBottom: Math.max(insets.bottom, 20),
        paddingHorizontal: 30,
      }}
      bg="#ffffffff">
      <TouchableOpacity activeOpacity={0.7} onPress={() => handleTabPress('home', onHomePress)}>
        <Home color={getIconColor('home')} size={24} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleTabPress('collection', onCollectionPress)}>
        <StretchHorizontal color={getIconColor('collection')} size={24} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleTabPress('statistics', onStatisticsPress)}>
        <BarChart2 color={getIconColor('statistics')} size={24} />
      </TouchableOpacity>
    </XStack>
  );
};

export default TabsFooter;

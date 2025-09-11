import React from 'react';
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
  
  const getIconColor = (tabName: string) => {
    return activeTab === tabName ? '#ffad31' : '#a8a8a8';
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
      bg="#ffffffff"
    >
      <TouchableOpacity activeOpacity={0.7} onPress={onHomePress}>
        <Home color={getIconColor('home')} size={24} />
      </TouchableOpacity>
      
      <TouchableOpacity activeOpacity={0.7} onPress={onCollectionPress}>
        <StretchHorizontal color={getIconColor('collection')} size={24} />
      </TouchableOpacity>
      
      <TouchableOpacity activeOpacity={0.7} onPress={onStatisticsPress}>
        <BarChart2 color={getIconColor('statistics')} size={24} />
      </TouchableOpacity>
    </XStack>
  );
};

export default TabsFooter;

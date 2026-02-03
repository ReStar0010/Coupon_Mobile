import { Tabs, useSegments } from 'expo-router';
import { Home, StretchHorizontal, BarChart2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_PADDING_TOP = 8;
const TAB_BAR_PADDING_BOTTOM_BASE = 8;

export default function TabLayout() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // 當導航到嵌套頁面時隱藏 tab bar
  // segments: ['(tabs)', 'easyuse'] = root (顯示)
  // segments: ['(tabs)', 'easyuse', '[id]'] = nested (隱藏)
  const hideTabBar = segments.length > 2;

  // 底部 padding 含 safe area，讓 tab bar 貼齊螢幕底並避開 home indicator
  const bottomPadding = TAB_BAR_PADDING_BOTTOM_BASE + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffad31',
        tabBarInactiveTintColor: '#a8a8a8',
        tabBarStyle: hideTabBar ? { display: 'none' } : {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          paddingTop: TAB_BAR_PADDING_TOP,
          paddingBottom: bottomPadding,
        },
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="easyuse"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => <StretchHorizontal color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistics',
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

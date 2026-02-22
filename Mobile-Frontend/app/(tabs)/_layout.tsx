import { Tabs, useSegments } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
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

  // LogoIcon 現在會根據 color prop 使用與 StretchHorizontal/BarChart2 一致的顏色
  const LogoIcon = ({ color = '#a8a8a8', size = 24 }: { color?: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23.9895 16.8578C23.9895 20.7967 20.7963 23.9898 16.8574 23.9898C12.9185 23.9898 9.72544 20.7967 9.72544 16.8578C9.72544 12.9188 12.9185 9.72571 16.8574 9.72571C20.7963 9.72571 23.9895 12.9188 23.9895 16.8578Z"
        fill={color}
      />
      <Path
        d="M2.08892 12.1754C0.751406 10.8378 2.85613e-07 9.02378 0 7.13224C-2.85612e-07 5.2407 0.751405 3.42664 2.08892 2.08912C3.42643 0.751602 5.24048 0.000191455 7.13201 0.000190575C9.02353 0.000189696 10.8376 0.751599 12.1751 2.08912L9.65355 4.61068C8.9848 3.94192 8.07777 3.56621 7.13201 3.56621C6.18624 3.56621 5.27922 3.94192 4.61046 4.61068C3.94171 5.27944 3.566 6.18647 3.566 7.13224C3.566 8.07801 3.94171 8.98504 4.61046 9.6538L2.08892 12.1754Z"
        fill="#FFAD31"
      />
      <Path
        d="M0.691765 23.3084C-0.219762 22.3968 -0.235644 20.9031 0.675883 19.9915L19.9915 0.67576C20.9031 -0.235772 22.3968 -0.21989 23.3084 0.691642C24.2199 1.60317 24.2358 3.09694 23.3242 4.00847L4.00858 23.3242C3.09705 24.2358 1.60329 24.2199 0.691765 23.3084Z"
        fill={color}
      />
      <Path
        d="M20.3586 16.7929C20.3586 18.7624 18.7621 20.3589 16.7926 20.3589C14.8232 20.3589 13.2266 18.7624 13.2266 16.7929C13.2266 14.8235 14.8232 13.2269 16.7926 13.2269C18.7621 13.2269 20.3586 14.8235 20.3586 16.7929Z"
        fill="#FFAD31"
      />
    </Svg>
  );

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
          title: 'CouPro',
          tabBarIcon: ({ color, size }) => <LogoIcon color={color} size={size} />,
          // 從其他 tab（如專屬優惠）點優惠券進入 easyuse/[id] 後，返回會切到 collection，
          // 但 easyuse 的 stack 仍保留 [id]。點 CouPro 時會再次看到該優惠券。
          // 讓 tab 失焦時自動 pop 回頂層，下次進入 CouPro 會看到 easy use 首頁。
          popToTopOnBlur: true,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: '專屬優惠',
          tabBarIcon: ({ color, size }) => <StretchHorizontal color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: '成就列表',
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

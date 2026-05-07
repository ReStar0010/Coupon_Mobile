import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import LogoIcon from '../icons/LogoIcon';

type TabName = 'home' | 'map' | 'spinner';

interface TabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  dark?: boolean;
  bottomInset?: number;
}

interface TabConfig {
  id: TabName;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'map', label: 'CouMap' },
  { id: 'home', label: 'CouPro' },
  { id: 'spinner', label: 'Spinner' },
];

function MapIcon({ active, iconColor }: { active: boolean; iconColor: string }) {
  const fillColor = active ? colors.yellow : 'none';
  const strokeColor = active ? colors.yellow : iconColor;
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Circle cx={12} cy={9} r={2.5} fill={active ? colors.fg : iconColor} />
    </Svg>
  );
}

function SpinnerIcon({ active, iconColor }: { active: boolean; iconColor: string }) {
  const c = active ? colors.yellow : iconColor;
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={12} r={3} fill={c} />
      <Line x1={12} y1={2} x2={12} y2={5.5} stroke={c} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function TabBar({
  activeTab,
  onTabPress,
  dark = false,
  bottomInset = 0,
}: TabBarProps): React.JSX.Element {
  const iconColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.45)';
  const bg = dark ? '#1E1E1E' : colors.fg;
  const homeBgActive = activeTab === 'home' ? colors.yellow : dark ? '#2C2C2C' : '#F0F0EB';

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingBottom: bottomInset }]}>
      {/* Map tab — left */}
      <Pressable
        testID={activeTab === 'map' ? 'tab-map-active' : 'tab-map'}
        onPress={() => onTabPress('map')}
        style={[styles.sideTab, styles.leftTab]}
      >
        <MapIcon active={activeTab === 'map'} iconColor={iconColor} />
        <Text
          style={[
            styles.tabLabel,
            { color: activeTab === 'map' ? colors.yellow : iconColor },
            activeTab === 'map' && styles.tabLabelActive,
          ]}
        >
          CouMap
        </Text>
      </Pressable>

      {/* Home tab — center raised */}
      <Pressable
        testID={activeTab === 'home' ? 'tab-home-active' : 'tab-home'}
        onPress={() => onTabPress('home')}
        style={styles.homeTabContainer}
      >
        <View style={styles.homeBtnWrapper}>
          <View
            style={[
              styles.homeBtnShadow,
              { top: 5, left: 5 },
            ]}
          />
          <View style={[styles.homeBtn, { backgroundColor: homeBgActive }]}>
            <LogoIcon size={36} />
          </View>
        </View>
        <Text
          style={[
            styles.homeLabel,
            {
              color: activeTab === 'home'
                ? colors.yellow
                : dark
                  ? 'rgba(255,255,255,0.5)'
                  : 'rgba(255,255,255,0.55)',
              backgroundColor: bg,
            },
          ]}
        >
          CouPro
        </Text>
      </Pressable>

      {/* Spinner tab — right-left of settings */}
      <Pressable
        testID={activeTab === 'spinner' ? 'tab-spinner-active' : 'tab-spinner'}
        onPress={() => onTabPress('spinner')}
        style={styles.sideTab}
      >
        <SpinnerIcon active={activeTab === 'spinner'} iconColor={iconColor} />
        <Text
          style={[
            styles.tabLabel,
            { color: activeTab === 'spinner' ? colors.yellow : iconColor },
            activeTab === 'spinner' && styles.tabLabelActive,
          ]}
        >
          Spinner
        </Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 2.5,
    borderTopColor: colors.border,
    position: 'relative',
    zIndex: 50,
  },
  sideTab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: '100%',
  },
  leftTab: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.09)',
  },
  homeTabContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    width: 88,
    marginTop: -22,
  },
  homeBtnWrapper: {
    position: 'relative',
    width: 58,
    height: 58,
  },
  homeBtnShadow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  homeBtn: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  homeLabel: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingBottom: 2,
  },
  tabLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});

import React from 'react';
import { View, Text } from 'tamagui';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Gift, ChevronRight } from 'lucide-react-native';
import { COLORS, SHADOWS, BORDER_RADIUS } from '@/app/constants/theme';

interface DailyDrawBannerProps {
  onClick: () => void;
}

const DailyDrawBanner: React.FC<DailyDrawBannerProps> = ({ onClick }) => {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onClick} activeOpacity={0.92}>
        <View style={[styles.card, SHADOWS.medium]}>
          <View style={styles.row}>
            <View style={styles.left}>
              <View style={styles.iconBox}>
                <Gift size={26} color={COLORS.white} strokeWidth={2.2} />
              </View>
              <View style={styles.textBlock}>
                <Text fontSize={18} fontWeight="700" color={COLORS.white}>
                  每日抽獎
                </Text>
                <Text fontSize={13} color="rgba(255,255,255,0.9)" numberOfLines={1}>
                  點擊抽取今日專屬優惠
                </Text>
              </View>
            </View>
            <View style={styles.arrowBox}>
              <ChevronRight size={22} color={COLORS.white} strokeWidth={2.5} />
            </View>
          </View>
          <View style={styles.bar} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  arrowBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: 4,
    width: '100%',
    backgroundColor: COLORS.primaryDark,
    opacity: 0.6,
  },
});

export default DailyDrawBanner;

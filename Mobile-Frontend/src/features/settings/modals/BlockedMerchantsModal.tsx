import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { getBlockedMerchants, unblockMerchant, type Merchant } from '@/src/services/api/merchants';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BlockedMerchantsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BlockedMerchantsModal({
  visible,
  onClose,
}: BlockedMerchantsModalProps): React.JSX.Element {
  const [list, setList] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const data = await getBlockedMerchants();
        if (!cancelled) {
          setList(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || '載入失敗，請稍後再試');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function handleUnblock(id: string): Promise<void> {
    // Optimistic remove; restore on failure.
    const snapshot = list;
    setList((prev) => prev.filter((m) => m.id !== id));
    setError(null);
    try {
      await unblockMerchant(id);
    } catch (err) {
      setList(snapshot);
      setError((err as Error).message || '解除失敗，請稍後再試');
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View testID="blocked-modal" style={[styles.sheet, { maxHeight: SCREEN_HEIGHT * 0.7 }]}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>封鎖商家</Text>
          <Text style={styles.subtitle}>
            封鎖的商家不會出現在你的 CouMap 或優惠通知中。
          </Text>

          {error ? (
            <Text testID="blocked-error" style={styles.errorText}>{error}</Text>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {loading ? (
              <View testID="blocked-loading" style={styles.loadingBox}>
                <ActivityIndicator color={colors.fg} />
              </View>
            ) : list.length === 0 ? (
              <Text style={styles.emptyText}>尚未封鎖任何商家</Text>
            ) : (
              list.map((merchant) => (
                <View key={merchant.id} style={styles.merchantRow}>
                  <View style={styles.merchantShadow} />
                  <View style={styles.merchantCard}>
                    <Text style={styles.merchantName}>{merchant.name}</Text>
                    <Pressable
                      testID={`btn-unblock-${merchant.id}`}
                      style={styles.unblockBtn}
                      onPress={() => { void handleUnblock(merchant.id); }}
                    >
                      <Text style={styles.unblockText}>解除</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.doneBtnWrapper}>
            <View style={styles.doneBtnShadow} />
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>完成</Text>
            </Pressable>
          </View>
        </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  accentStrip: {
    height: 6,
    backgroundColor: colors.yellow,
    marginHorizontal: -16,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: colors.red,
    marginBottom: 8,
  },
  list: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
  },
  merchantRow: {
    position: 'relative',
    marginBottom: 8,
  },
  merchantShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
  },
  merchantName: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.fg,
    flex: 1,
  },
  unblockBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
  },
  unblockText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#fff',
  },
  doneBtnWrapper: {
    position: 'relative',
  },
  doneBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
});

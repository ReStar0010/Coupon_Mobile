import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { apiClient } from '@/src/services/api/client';
import { normalizeError } from '@/src/services/api/errors';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export type LegalKind = 'terms' | 'privacy' | 'guidelines';

interface LegalTextModalProps {
  visible: boolean;
  type: LegalKind;
  onClose: () => void;
}

interface LegalResponse {
  title?: string;
  content?: string;
  prohibited_content?: unknown;
  penalties?: unknown;
  support_contact?: string;
}

const ENDPOINT: Record<LegalKind, string> = {
  terms: '/api/terms/',
  privacy: '/api/privacy-policy/',
  guidelines: '/api/content-guidelines/',
};

const FALLBACK_TITLE: Record<LegalKind, string> = {
  terms: '服務條款',
  privacy: '隱私政策',
  guidelines: '內容規範',
};

export default function LegalTextModal({
  visible,
  type,
  onClose,
}: LegalTextModalProps): React.JSX.Element {
  const [title, setTitle] = useState<string>(FALLBACK_TITLE[type]);
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      setBody('');
      setTitle(FALLBACK_TITLE[type]);
      try {
        const response = await apiClient.get<LegalResponse>(ENDPOINT[type]);
        if (cancelled) return;
        const data = response.data;
        if (data.title) setTitle(data.title);
        if (typeof data.content === 'string') {
          setBody(data.content);
        } else if (type === 'guidelines') {
          // Guidelines endpoint returns structured fields — flatten for display.
          const lines: string[] = [];
          if (Array.isArray(data.prohibited_content)) {
            lines.push('禁止內容：');
            for (const item of data.prohibited_content) {
              lines.push(`• ${String(item)}`);
            }
          }
          if (Array.isArray(data.penalties)) {
            lines.push('', '處罰規則：');
            for (const item of data.penalties) {
              lines.push(`• ${String(item)}`);
            }
          }
          if (data.support_contact) {
            lines.push('', `聯絡信箱：${data.support_contact}`);
          }
          setBody(lines.join('\n'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(normalizeError(err).message || '載入失敗，請稍後再試');
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
  }, [visible, type]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheet, { height: SCREEN_HEIGHT * 0.72 }]}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View testID="legal-loading" style={styles.loadingBox}>
                <ActivityIndicator color={colors.fg} />
              </View>
            ) : error ? (
              <Text testID="legal-error" style={styles.errorText}>{error}</Text>
            ) : (
              <Text style={styles.body}>{body}</Text>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.closeBtnWrapper}>
              <View style={styles.closeBtnShadow} />
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>關閉</Text>
              </Pressable>
            </View>
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
    paddingTop: 0,
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
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: colors.red,
    paddingVertical: 20,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
    lineHeight: 21,
  },
  footer: {
    paddingVertical: 14,
    paddingBottom: 32,
    backgroundColor: colors.bg,
  },
  closeBtnWrapper: {
    position: 'relative',
  },
  closeBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  closeBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
});

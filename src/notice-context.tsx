import { Ionicons } from '@expo/vector-icons';
import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThemedStyles, fonts, shadows, useTheme } from '@/src/theme';

type NoticeTone = 'error' | 'success' | 'info';

interface Notice {
  title: string;
  message?: string;
  tone?: NoticeTone;
}

const NoticeContext = createContext<((notice: Notice) => void) | null>(null);

export function NoticeProvider({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((next: Notice) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(next);
    timer.current = setTimeout(() => setNotice(null), 5_000);
  }, []);
  const value = useMemo(() => showNotice, [showNotice]);
  const tone = notice?.tone ?? 'info';

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {notice && (
        <View pointerEvents="box-none" style={[styles.layer, { paddingTop: Math.max(insets.top, 10) + 8 }]}>
          <View accessibilityRole="alert" style={[styles.notice, styles[tone]]}>
            <Ionicons
              name={tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'}
              size={22}
              color={tone === 'error' ? colors.danger : tone === 'success' ? colors.success : colors.primary}
            />
            <View style={styles.copy}>
              <Text style={styles.title}>{notice.title}</Text>
              {!!notice.message && <Text style={styles.message}>{notice.message}</Text>}
            </View>
            <Pressable accessibilityLabel="Dismiss message" hitSlop={8} onPress={() => setNotice(null)}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const value = useContext(NoticeContext);
  if (!value) throw new Error('useNotice must be used inside NoticeProvider');
  return value;
}

const useStyles = createThemedStyles((colors) => ({
  layer: { position: 'absolute', top: 0, right: 0, left: 0, zIndex: 100, paddingHorizontal: 14 },
  notice: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 18, padding: 14, backgroundColor: colors.surface, ...shadows.media },
  error: { borderColor: colors.danger },
  success: { borderColor: colors.success },
  info: { borderColor: colors.primary },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontFamily: fonts.sansSemibold, fontSize: 14 },
  message: { color: colors.muted, fontSize: 12, lineHeight: 18 },
}));

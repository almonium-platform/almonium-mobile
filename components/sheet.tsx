import type { PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createThemedStyles, shadows, useTheme } from '@/src/theme';

/**
 * Every secondary surface on the phone is a bottom sheet: 28px top radius, a grabber, dismissed
 * by the scrim or the system back gesture. The slide is one of the things reduce motion stops.
 */
export function Sheet({
  visible,
  onClose,
  children,
  scroll = true,
  contentStyle,
  maxHeight = '88%',
}: PropsWithChildren<{
  visible: boolean;
  onClose(): void;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  maxHeight?: ViewStyle['maxHeight'];
}>) {
  const { reduceMotion } = useTheme();
  const styles = useStyles();
  return (
    <Modal transparent animationType={reduceMotion ? 'fade' : 'slide'} visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight }]}>
        <View style={styles.grabber} />
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: isDark ? colors.overlay : colors.canvas,
    ...(isDark ? { borderWidth: 1, borderColor: colors.border } : shadows.media),
  },
  grabber: { width: 38, height: 4, alignSelf: 'center', marginTop: 10, borderRadius: 2, backgroundColor: colors.border },
  content: { gap: 14, padding: 20, paddingTop: 14 },
}));

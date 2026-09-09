import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createThemedStyles, shadows, useTheme } from '@/src/theme';

const openDuration = 260;
const closeDuration = 210;

/**
 * Every secondary surface on the phone is a bottom sheet: 28px top radius, a grabber, dismissed
 * by the scrim or the system back gesture. The slide is one of the things reduce motion stops.
 *
 * The sheet rolls itself rather than letting Modal do it: Modal's slide takes the scrim down with
 * the sheet, and it cannot see a dismissal coming, so a closing sheet blinked out. Here the sheet
 * stays mounted until it has finished travelling, and the scrim fades while the sheet drops.
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
  const window = useWindowDimensions();
  // Mounted covers the whole visit, including the drop back out after `visible` turns false.
  const [mounted, setMounted] = useState(visible);
  // The sheet travels exactly its own height, so it clears the screen whatever it is holding.
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 120 : visible ? openDuration : closeDuration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [mounted, progress, reduceMotion, visible]);

  function measure(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.height;
    setHeight((current) => (Math.abs(current - next) < 1 ? current : next));
  }

  const travel = progress.interpolate({
    inputRange: [0, 1],
    // Until the first layout, the whole window is the safe distance: the sheet is never parked
    // on screen waiting to be measured.
    outputRange: [height || window.height, 0],
  });

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={onClose}>
      <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.scrim, { opacity: progress }]}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        onLayout={measure}
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.sheetMotion,
          { maxHeight },
          reduceMotion ? { opacity: progress } : { transform: [{ translateY: travel }] },
        ]}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          {scroll ? (
            <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, contentStyle]}>{children}</View>
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheetMotion: { position: 'absolute', right: 0, bottom: 0, left: 0 },
  sheet: {
    // The cap lives on the moving frame, so a tall sheet shrinks into it instead of overflowing.
    flexShrink: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: isDark ? colors.overlay : colors.canvas,
    ...(isDark ? { borderWidth: 1, borderColor: colors.border } : shadows.media),
  },
  grabber: { width: 38, height: 4, alignSelf: 'center', marginTop: 10, borderRadius: 2, backgroundColor: colors.border },
  content: { gap: 14, padding: 20, paddingTop: 14 },
}));

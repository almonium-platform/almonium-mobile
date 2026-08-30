import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gradients } from '@/src/theme';

export function AvatarMark({
  premium = false,
  size = 46,
}: {
  premium?: boolean;
  size?: number;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  const mark = (
    <Text
      accessibilityElementsHidden
      style={[styles.mark, { fontSize: size * 0.5 }, premium && styles.markPremium]}>
      ∞
    </Text>
  );

  if (premium) {
    return (
      <LinearGradient
        accessibilityLabel="Premium member"
        colors={gradients.premium}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.frame, frame]}>
        {mark}
      </LinearGradient>
    );
  }

  return (
    <View accessibilityLabel="Member" style={[styles.frame, styles.free, frame]}>
      {mark}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  free: { backgroundColor: colors.border },
  mark: { color: colors.ink, fontFamily: fonts.serif, lineHeight: 30 },
  markPremium: { color: colors.canvas },
});

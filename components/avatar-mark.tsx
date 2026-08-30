import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { createThemedStyles, fonts, gradients, useTheme } from '@/src/theme';

export function AvatarMark({
  premium = false,
  size = 46,
}: {
  premium?: boolean;
  size?: number;
}) {
  const { isDark } = useTheme();
  const styles = useStyles();
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
        colors={isDark ? gradients.premiumDark : gradients.premium}
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

const useStyles = createThemedStyles((colors) => ({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  free: { backgroundColor: colors.border },
  mark: { color: colors.ink, fontFamily: fonts.serif, lineHeight: 30 },
  markPremium: { color: colors.canvas },
}));

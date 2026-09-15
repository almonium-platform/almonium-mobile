import { Image } from 'expo-image';
import { View } from 'react-native';

import { createThemedStyles, shadows } from '@/src/theme';

/**
 * The frame carries the shadow and the image clips itself to the same circle. On Android a view
 * that both casts a `boxShadow` and clips (`overflow: 'hidden'`) drops its children from the
 * drawable, so in light mode the mark came out as a bare white disc.
 */
export function BrandMark({ size = 54 }: { size?: number }) {
  const styles = useStyles();
  const radius = size / 2;
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={require('../assets/images/almonium-logo.png')}
        style={[styles.image, { borderRadius: radius }]}
        contentFit="contain"
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  frame: {
    backgroundColor: colors.surface,
    ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card),
  },
  image: { width: '100%', height: '100%' },
}));

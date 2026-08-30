import { Image } from 'expo-image';
import { View } from 'react-native';

import { createThemedStyles, shadows } from '@/src/theme';

export function BrandMark({ size = 54 }: { size?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={require('../assets/images/almonium-logo.png')}
        style={styles.image}
        contentFit="contain"
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card),
  },
  image: { width: '100%', height: '100%' },
}));

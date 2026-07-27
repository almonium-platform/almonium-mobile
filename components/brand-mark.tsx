import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, shadows } from '@/src/theme';

export function BrandMark({ size = 54 }: { size?: number }) {
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

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.white,
    ...shadows.card,
  },
  image: { width: '100%', height: '100%' },
});

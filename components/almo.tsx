import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme';

const poses = {
  standing: require('../assets/images/almo-standing.png'),
  asleep: require('../assets/images/almo-asleep.png'),
  offering: require('../assets/images/almo-offering.png'),
  reading: require('../assets/images/almo-reading.png'),
} as const;

/** The sheets are 124 × 130; every size asks for a height and takes the width that goes with it. */
const aspect = 124 / 130;

/**
 * Almo is an engraving: black ink and paper-white highlights, cut out hard. On the light ground the
 * highlights melt into the page and the ink draws him; on a dark ground the ink vanishes and only
 * the highlights are left, a jagged pink rim. So in dark mode he sits on a disc of reader paper,
 * the same tone the reading surface keeps, and the ink reads again.
 */
export function Almo({ pose, height, style }: { pose: keyof typeof poses; height: number; style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  const image = <Image source={poses[pose]} contentFit="contain" style={{ width: Math.round(height * aspect), height }} />;
  if (!isDark) return <View style={style}>{image}</View>;
  const disc = Math.round(height * 1.24);
  return (
    <View style={[{ width: disc, height: disc, borderRadius: disc / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.reader }, style]}>
      {image}
    </View>
  );
}

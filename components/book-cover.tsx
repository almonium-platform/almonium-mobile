import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ImageStyle, StyleProp, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/src/theme';

const coverColors = ['#6f405c', '#315c62', '#8a543f', '#4f5f3d', '#5a4b78', '#9a6a33'];

export function BookCover({
  title,
  author,
  workSlug,
  coverUrl,
  style,
}: {
  title: string;
  author: string;
  workSlug: string;
  coverUrl: string | null;
  style?: StyleProp<ImageStyle>;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const color = useMemo(() => coverColors[hash(workSlug) % coverColors.length], [workSlug]);
  useEffect(() => setImageFailed(false), [coverUrl]);

  if (coverUrl && !imageFailed) {
    return (
      <Image
        source={coverUrl}
        style={style}
        contentFit="cover"
        transition={180}
        onError={() => setImageFailed(true)}
        accessibilityLabel={`${title} by ${author} cover`}
      />
    );
  }

  return (
    <View style={[styles.cover, style]} accessibilityLabel={`${title} by ${author} cover`}>
      <View style={[styles.colorField, { backgroundColor: color }]} />
      <Text style={[styles.imprint, { color }]}>ALMONIUM</Text>
      <Text style={styles.title} numberOfLines={4}>{title}</Text>
      <View style={[styles.rule, { backgroundColor: color }]} />
      <Text style={styles.author} numberOfLines={2}>{author}</Text>
    </View>
  );
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#f9f1df',
  },
  colorField: { position: 'absolute', inset: 0, bottom: undefined, height: 9 },
  imprint: { marginTop: 4, fontSize: 7, letterSpacing: 1.3, fontWeight: '600' },
  title: {
    marginTop: 'auto',
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  rule: { width: '32%', height: 2, marginVertical: 10 },
  author: {
    marginBottom: 'auto',
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 9,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

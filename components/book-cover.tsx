import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { authorSurname, hyphenateForWidth, shortTitle } from '@/src/shelf';
import { colors, fonts } from '@/src/theme';

/**
 * The typographic cover (design 4a, correction 3): the author's surname as eyebrow, the short
 * title as body, a hairline or the edition levels at the foot. The app name is never on a cover.
 * Each work keeps one of four bindings by its slug; type scales with the width, so the same cover
 * reads at 44pt in a library row and at 126pt on the book page. A real cover image wins when the
 * edition has one.
 */
const bindings = [
  { field: colors.ink, eyebrow: '#C9A8C4', title: colors.canvas, foot: 'rgba(249,246,245,0.6)', rule: 'rgba(249,246,245,0.28)', border: null },
  { field: colors.chatChannel, eyebrow: 'rgba(255,255,255,0.7)', title: colors.canvas, foot: 'rgba(249,246,245,0.6)', rule: 'rgba(255,255,255,0.28)', border: null },
  { field: colors.premium, eyebrow: 'rgba(255,255,255,0.7)', title: colors.canvas, foot: 'rgba(249,246,245,0.6)', rule: 'rgba(255,255,255,0.28)', border: null },
  { field: colors.canvas, eyebrow: colors.muted, title: colors.ink, foot: colors.muted, rule: colors.line, border: colors.line },
] as const;

export function BookCover({
  title,
  author,
  workSlug,
  coverUrl,
  width,
  height,
  foot,
  rule = false,
}: {
  title: string;
  author: string;
  workSlug: string;
  coverUrl: string | null;
  width: number;
  height: number;
  /** The edition levels on the foot ("B2 · C1"); absent for a single edition. */
  foot?: string;
  /** A hairline at the foot when there is nothing to say there (the shelf). */
  rule?: boolean;
}) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const binding = useMemo(() => bindings[hash(workSlug) % bindings.length], [workSlug]);
  useEffect(() => setImageFailed(false), [coverUrl]);
  const coverLabel = t('{title} by {author} cover', { title, author });
  const metrics = coverMetrics(width);
  const size = { width, height, borderRadius: metrics.radius };

  if (coverUrl && !imageFailed) {
    return (
      <Image
        source={coverUrl}
        style={size}
        contentFit="cover"
        transition={180}
        onError={() => setImageFailed(true)}
        accessibilityLabel={coverLabel}
      />
    );
  }

  return (
    <View
      style={[
        styles.cover,
        size,
        { paddingVertical: metrics.paddingV, paddingHorizontal: metrics.paddingH, backgroundColor: binding.field },
        binding.border ? { borderWidth: 1, borderColor: binding.border } : null,
      ]}
      accessibilityLabel={coverLabel}>
      <Text numberOfLines={1} style={[styles.eyebrow, { fontSize: metrics.eyebrow, letterSpacing: metrics.eyebrow / 6, color: binding.eyebrow }]}>
        {authorSurname(author).toUpperCase()}
      </Text>
      <Text
        numberOfLines={metrics.titleLines}
        android_hyphenationFrequency="full"
        style={[styles.title, { fontSize: metrics.title, lineHeight: Math.round(metrics.title * 1.2), color: binding.title }]}>
        {hyphenateForWidth(shortTitle(title), metrics.perLine)}
      </Text>
      {foot ? (
        <Text numberOfLines={1} style={[styles.foot, { fontSize: metrics.foot, color: binding.foot }]}>{foot}</Text>
      ) : rule ? (
        <View style={[styles.rule, { backgroundColor: binding.rule }]} />
      ) : null}
    </View>
  );
}

/** Type and insets for a cover of this width; 96pt is the drawn size, the rest follow it gently. */
export function coverMetrics(width: number) {
  const scale = Math.pow(width / 96, 0.7);
  const title = round(14 * scale);
  const paddingH = Math.round(10 * scale);
  return {
    title,
    eyebrow: round(Math.max(5.5, 7 * Math.pow(width / 96, 0.4))),
    foot: round(7.5 * scale),
    paddingH,
    paddingV: Math.round(12 * scale),
    radius: Math.round(8 * scale),
    titleLines: width < 60 ? 3 : 4,
    perLine: Math.max(3, Math.floor((width - paddingH * 2) / (title * 0.56))),
  };
}

function round(value: number) {
  return Math.round(value * 2) / 2;
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
  cover: { overflow: 'hidden', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.mono, textTransform: 'uppercase' },
  title: { fontFamily: fonts.serif, fontWeight: '600', marginVertical: 'auto' },
  foot: { fontFamily: fonts.mono },
  rule: { height: 1 },
});

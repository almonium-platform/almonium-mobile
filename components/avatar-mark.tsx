import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import {
  animalFromUrl,
  animalLabels,
  avatarLetter,
  engravingMinimumSize,
  schematics,
  type Animal,
} from '@/src/avatars';
import { fonts, useTheme } from '@/src/theme';

/** The pale ground every avatar keeps, and the dark one it flips to. The disc never moves on tier. */
const ground = { light: '#ECE5EA', dark: '#2E2736' };
/** Free ink: flat plum on paper, the warm grey-mauve of secondary text at night. */
const freeInk = { light: '#3D3348', dark: '#8E7F95' };
/** Member ink: the gradient runs through the strokes, never the ground. */
const memberInk = { light: ['#8F2356', '#5A1A74'], dark: ['#D98BA8', '#B07FD8'] } as const;
const selectionRing = { light: '#872657', dark: '#CBA3E0' };

export type AvatarRing = 'selection' | 'member';

/**
 * One rule for the tier, two renderings per animal. Engravings at 48 and above, the line
 * schematic below; the letter disc is the same monochrome material as the drawings. A ring is
 * opt-in: selection in the picker, member only on social surfaces, never both.
 */
export function AvatarMark({
  avatarUrl,
  username,
  premium = false,
  size = 46,
  ring,
  ringOffset,
}: {
  avatarUrl?: string | null;
  username?: string | null;
  premium?: boolean;
  size?: number;
  ring?: AvatarRing;
  /** The colour behind the ring gap: white on paper, the card colour at night. */
  ringOffset?: string;
}) {
  const { colors, isDark } = useTheme();
  const mode = isDark ? 'dark' : 'light';
  const animal = animalFromUrl(avatarUrl);
  const legacyImage = !animal && avatarUrl ? avatarUrl : null;
  const ringWidth = size >= 40 ? 2 : 1.5;
  const gap = ring ? (size >= 40 ? 2 : 1.5) : 0;
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const label = animal
    ? `${animalLabels[animal]} avatar${premium ? ', member' : ''}`
    : premium
      ? 'Member'
      : 'Member avatar';

  const disc = (
    <View
      accessibilityLabel={label}
      style={[styles.disc, frame, { backgroundColor: ground[mode] }]}>
      {legacyImage ? (
        <Image accessibilityIgnoresInvertColors source={{ uri: legacyImage }} contentFit="cover" style={frame} />
      ) : animal && size >= engravingMinimumSize ? (
        <Engraving uri={avatarUrl!} size={size} premium={premium} mode={mode} />
      ) : animal ? (
        <Schematic animal={animal} size={size} premium={premium} mode={mode} />
      ) : (
        <Letter letter={avatarLetter(username)} size={size} premium={premium} mode={mode} />
      )}
    </View>
  );

  if (!ring) return disc;
  const ringColor = ring === 'selection' ? selectionRing[mode] : '#8F2356';
  const outer = size + 2 * (gap + ringWidth);
  return (
    <View
      style={[
        styles.ring,
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: ringWidth,
          borderColor: ringColor,
          padding: gap,
          backgroundColor: ringOffset ?? (isDark ? colors.surface : '#FFFFFF'),
        },
      ]}>
      {disc}
    </View>
  );
}

function Engraving({ uri, size, premium, mode }: { uri: string; size: number; premium: boolean; mode: 'light' | 'dark' }) {
  const image = (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri }}
      contentFit="contain"
      // The engraving is plum ink on transparency; tint it so a dark disc gets light strokes.
      tintColor={premium && Platform.OS !== 'web' ? undefined : freeInk[mode]}
      style={{ width: size, height: size }}
    />
  );
  if (!premium || Platform.OS === 'web') return image;
  return (
    <MaskedView style={{ width: size, height: size }} maskElement={image}>
      <LinearGradient
        colors={[...memberInk[mode]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
}

function Schematic({ animal, size, premium, mode }: { animal: Animal; size: number; premium: boolean; mode: 'light' | 'dark' }) {
  const glyph = size * 0.62;
  const stroke = premium ? 'url(#member-ink)' : freeInk[mode];
  return (
    <Svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none">
      <Defs>
        <SvgGradient id="member-ink" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={memberInk[mode][0]} />
          <Stop offset="1" stopColor={memberInk[mode][1]} />
        </SvgGradient>
      </Defs>
      <Path d={schematics[animal].outline} stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={schematics[animal].detail} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Letter({ letter, size, premium, mode }: { letter: string; size: number; premium: boolean; mode: 'light' | 'dark' }) {
  const fill = premium ? 'url(#member-letter)' : freeInk[mode];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <SvgGradient id="member-letter" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={memberInk[mode][0]} />
          <Stop offset="1" stopColor={memberInk[mode][1]} />
        </SvgGradient>
      </Defs>
      <SvgText
        x={size / 2}
        y={size / 2}
        fill={fill}
        fontFamily={fonts.serif}
        fontSize={size * 0.5}
        fontWeight="600"
        textAnchor="middle"
        alignmentBaseline="central">
        {letter}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { alignItems: 'center', justifyContent: 'center' },
});

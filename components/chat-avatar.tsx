import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { AvatarMark } from '@/components/avatar-mark';
import { channelTypes, type ChannelType } from '@/src/chat';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

/**
 * The emblem for a channel row. Which one is drawn follows the channel type, never its name.
 * Saved Messages carries no image of its own, so its bookmark is drawn locally rather than
 * fetched or reduced to a letter avatar; broadcast rooms carry real hosted artwork.
 */
export function ChatAvatar({
  type,
  image,
  size = 46,
}: {
  type: ChannelType;
  image?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const frame = { width: size, height: size, borderRadius: size / 2 };

  if (type === channelTypes.self) {
    return (
      <View accessibilityLabel="Saved Messages" style={[styles.frame, styles.saved, frame]}>
        <Ionicons name="bookmark" size={size * 0.44} color={colors.white} />
      </View>
    );
  }

  if (image) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: image }}
        contentFit="cover"
        style={[styles.frame, frame]}
      />
    );
  }

  if (type === channelTypes.broadcast) {
    return (
      <View style={[styles.frame, styles.broadcast, frame]}>
        <Text style={[styles.brandMark, { fontSize: size * 0.46 }]}>∞</Text>
      </View>
    );
  }

  return <AvatarMark size={size} />;
}

const useStyles = createThemedStyles((colors) => ({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // The solid plum-raspberry, not the gradient: that one stays reserved for premium.
  saved: { backgroundColor: colors.premium },
  broadcast: { backgroundColor: colors.accentSoft },
  brandMark: { color: colors.primaryDark, fontFamily: fonts.serif },
}));

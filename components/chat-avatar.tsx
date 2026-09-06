import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { AvatarMark } from '@/components/avatar-mark';
import { animalFromUrl } from '@/src/avatars';
import { broadcastCode, channelTypes, type ChannelType } from '@/src/chat';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

/**
 * The emblem for a channel row, chosen by type and never by name. Saved Messages carries the
 * bookmark on its plum disc and a broadcast room carries its own mono code, so neither depends
 * on artwork being fetched; only a DM has a hosted image worth showing.
 */
export function ChatAvatar({
  type,
  channelId,
  image,
  name,
  size = 38,
}: {
  type: ChannelType;
  channelId?: string;
  image?: string;
  name?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const frame = { width: size, height: size, borderRadius: size / 2 };

  if (type === channelTypes.self) {
    return (
      <View accessibilityLabel="Saved Messages" style={[styles.frame, styles.saved, frame]}>
        <Ionicons name="bookmark" size={size * 0.45} color={colors.white} />
      </View>
    );
  }

  if (type === channelTypes.broadcast) {
    const code = broadcastCode(channelId ?? '');
    return (
      <View style={[styles.frame, styles.channel, frame]}>
        <Text style={[styles.code, { fontSize: code.length > 2 ? size * 0.26 : size * 0.29 }]}>{code}</Text>
      </View>
    );
  }

  // The other person's image is their avatar URL, so a bundled animal draws its schematic
  // here rather than fetching the engraving at a size where it would smudge.
  if (image && !animalFromUrl(image)) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: image }}
        contentFit="cover"
        style={[styles.frame, frame]}
      />
    );
  }

  return <AvatarMark avatarUrl={image} username={name} size={size} />;
}

const useStyles = createThemedStyles((colors) => ({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // The solid plum, not the gradient: that one stays reserved for premium.
  saved: { backgroundColor: colors.chatMine },
  channel: { backgroundColor: colors.chatChannel },
  code: { color: colors.white, fontFamily: fonts.sansMedium, letterSpacing: 0.5 },
}));

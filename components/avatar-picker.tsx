import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AvatarMark } from '@/components/avatar-mark';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { animalFromUrl, animalLabels, animals, avatarUrlFor } from '@/src/avatars';
import { config } from '@/src/config';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles } from '@/src/theme';

/**
 * The one picker. Settings and the onboarding profile step draw the same row, because the picker
 * is the one place where the avatar is the subject rather than incidental: the engraving above,
 * the schematic ghost under it, one tap selects both, and no preview circle, since the engraving
 * is the preview. Selection is the ring; there is no caption and no check mark.
 *
 * The ring moves on tap, not on the server's answer: choosing a drawing is cheap and reversible,
 * so the request runs behind the choice and only a failure puts the old ring back.
 */
export function AvatarPicker({ tileSize = 56, gap = 9 }: { tileSize?: number; gap?: number }) {
  const styles = useStyles();
  const { profile, patchProfile, refreshProfile } = useAuth();
  const showNotice = useNotice();
  // Taps can outrun the network, so only the newest one is allowed to roll back or refresh.
  const latestChoice = useRef(0);
  const current = animalFromUrl(profile?.avatarUrl);

  async function choose(url: string | null) {
    const previous = profile?.avatarUrl ?? null;
    if (url === previous) return;
    const choiceId = ++latestChoice.current;
    patchProfile({ avatarUrl: url });
    try {
      if (url) await api.chooseAvatar(url);
      else await api.resetAvatar();
      if (latestChoice.current === choiceId) await refreshProfile();
    } catch (error) {
      if (latestChoice.current === choiceId) patchProfile({ avatarUrl: previous });
      showNotice({ title: 'Could not change your avatar', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    }
  }

  const choices: { key: string; url: string | null; label: string }[] = [
    { key: 'letter', url: null, label: 'Your letter' },
    ...animals.map((animal) => ({ key: animal, url: avatarUrlFor(animal, config.webBaseUrl), label: animalLabels[animal] })),
  ];

  return (
    <View style={styles.picker}>
      <Text style={styles.eyebrow}>HOW YOU APPEAR</Text>
      <View style={[styles.row, { gap }]}>
        {choices.map((choice) => {
          const selected = choice.url ? current === animalFromUrl(choice.url) : !current && !profile?.avatarUrl;
          return (
            <Pressable
              key={choice.key}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ selected }}
              disabled={selected}
              onPress={() => void choose(choice.url)}
              style={[styles.tile, selected && styles.tileSelected]}>
              <AvatarMark
                avatarUrl={choice.url}
                username={profile?.username}
                premium={profile?.premium}
                size={tileSize}
              />
              <AvatarMark
                avatarUrl={choice.url}
                username={profile?.username}
                premium={profile?.premium}
                size={24}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>Your letter, or one of five drawings. The small one is how you appear in chats.</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  picker: { gap: 10 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  tile: {
    alignItems: 'center',
    gap: 8,
    padding: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: isDark ? '#CBA3E0' : '#872657' },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19 },
}));

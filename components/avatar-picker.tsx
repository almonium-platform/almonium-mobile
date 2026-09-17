import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { AvatarMark } from '@/components/avatar-mark';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { animalFromUrl, animalLabels, animals, avatarUrlFor } from '@/src/avatars';
import { config } from '@/src/config';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles } from '@/src/theme';

/**
 * The one picker. Settings and the onboarding profile step draw the same grid, because the
 * picker is the one place where the avatar is the subject rather than incidental: the engraving
 * above, the schematic ghost under it, one tap selects both, and no preview circle, since the
 * engraving is the preview. Six choices sit in a 3×2 grid, so no drawing is ever orphaned on a
 * row of its own. Selection is a ring on the disc and on its glyph separately (F11), never one
 * capsule around the pair; there is no caption and no check mark.
 *
 * The ring moves on tap, not on the server's answer: choosing a drawing is cheap and reversible,
 * so the request runs behind the choice and only a failure puts the old ring back.
 */
export function AvatarPicker({ tileSize = 64 }: { tileSize?: number }) {
  const { t } = useTranslation();
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
      showNotice({ title: t('Could not change your avatar'), message: error instanceof Error ? error.message : t('Try again.'), tone: 'error' });
    }
  }

  const choices: { key: string; url: string | null; label: string }[] = [
    { key: 'letter', url: null, label: t('Your letter') },
    ...animals.map((animal) => ({ key: animal, url: avatarUrlFor(animal, config.webBaseUrl), label: t(animalLabels[animal]) })),
  ];

  return (
    <View style={styles.picker}>
      <Text style={styles.eyebrow}>{t('HOW YOU APPEAR')}</Text>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {choices.map((choice) => {
          const selected = choice.url ? current === animalFromUrl(choice.url) : !current && !profile?.avatarUrl;
          const ring = selected ? 'selection' : undefined;
          return (
            <Pressable
              key={choice.key}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ selected }}
              disabled={selected}
              onPress={() => void choose(choice.url)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
              {/* Both marks keep their ringed footprint, so the grid does not shift when the ring moves. */}
              <View style={[styles.slot, { width: tileSize + 10, height: tileSize + 10 }]}>
                <AvatarMark avatarUrl={choice.url} username={profile?.username} premium={profile?.premium} size={tileSize} ring={ring} ringGap={3} ringOffset="transparent" />
              </View>
              <View style={[styles.slot, { width: 32, height: 32 }]}>
                <AvatarMark avatarUrl={choice.url} username={profile?.username} premium={profile?.premium} size={24} ring={ring} ringGap={2} ringOffset="transparent" />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>{t('Your letter, or one of five drawings. The small one is how you appear in chats.')}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  picker: { gap: 14 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  tile: { width: '33.333%', alignItems: 'center', gap: 6 },
  slot: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19 },
}));

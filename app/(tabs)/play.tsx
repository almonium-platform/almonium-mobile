import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { languageName } from '@/src/languages';
import { colors, fonts, shadows } from '@/src/theme';

export default function PlayScreen() {
  const { firebaseUser, profile } = useAuth();
  const languages = useMemo(
    () => profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) ?? [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(languages[0] ?? '');
  const cards = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(firebaseUser && language),
  });
  const count = cards.data?.filter((card) => card.activeLearning !== false).length ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>PLAY</Text>
            <Text style={styles.title}>
              {cards.isLoading ? 'Another way through your words' : count ? `Another way through the same ${count} ${count === 1 ? 'word' : 'words'}` : 'Put your vocabulary into play'}
            </Text>
          </View>
          {cards.isLoading && <ActivityIndicator color={colors.primary} />}
        </View>
        <Text style={styles.copy}>These modes use your {languageName(language)} vocabulary in different ways. Nothing here is required, and nothing expires.</Text>
        {languages.length > 1 && (
          <View style={styles.chips}>
            {languages.map((code) => (
              <Pressable key={code} onPress={() => setLanguage(code)} style={[styles.chip, language === code && styles.chipActive]}>
                <Text style={[styles.chipText, language === code && styles.chipTextActive]}>{languageName(code)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.featured}>
        <View style={styles.crossword} accessibilityElementsHidden>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
            <View key={cell} style={[styles.cell, (cell === 3 || cell === 8) && styles.cellAccent]} />
          ))}
        </View>
        <View style={styles.featuredCopy}>
          <View style={styles.metaRow}><Text style={styles.intent}>PRODUCE</Text><Text style={styles.meta}>about 6 minutes</Text></View>
          <Text style={styles.gameTitle}>Crossword</Text>
          <Text style={styles.copy}>Read a definition and spell the word. The grid will be built from vocabulary you chose to learn.</Text>
          <Button disabled>In development</Button>
          {!count && (
            <Pressable
              onPress={() => router.push({ pathname: '/card/new', params: { language } })}
            >
              <Text style={styles.link}>Keep a few words first</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>ALSO FROM YOUR DECK</Text>
      <GameRow
        icon="people-outline"
        name="Duel"
        intent="Recall · two players"
        description="Your deck against a friend’s. Missed words get another chance to stick."
      />
      <GameRow
        icon="trending-up-outline"
        name="Ladder"
        intent="Disambiguate · solo"
        description="Words of falling frequency until you find the edge of your reading range."
      />

      <Text style={styles.sectionLabel}>NOT FROM YOUR DECK</Text>
      <GameRow
        icon="swap-vertical-outline"
        name="Higher or Lower"
        intent="Frequency intuition"
        description={`Guess which of two ${languageName(language)} words is more common. A round changes nothing in your deck.`}
      />
      {cards.isError && <Text style={styles.error}>Your deck count could not be loaded. The game roadmap is still shown.</Text>}
    </ScrollView>
  );
}

function GameRow({ icon, name, intent, description }: { icon: keyof typeof Ionicons.glyphMap; name: string; intent: string; description: string }) {
  return (
    <View style={styles.gameRow}>
      <View style={styles.gameIcon}><Ionicons name={icon} size={23} color={colors.primary} /></View>
      <View style={styles.gameCopy}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.meta}>{intent}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text style={styles.soon}>Later</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 38, gap: 13 },
  heading: { gap: 10, paddingBottom: 7 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 29, lineHeight: 36, fontWeight: '600' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  featured: { borderRadius: 28, padding: 20, gap: 18, backgroundColor: colors.surface, ...shadows.card },
  crossword: { width: 116, flexDirection: 'row', flexWrap: 'wrap', gap: 5, transform: [{ rotate: '-5deg' }] },
  cell: { width: 32, height: 32, borderRadius: 7, borderWidth: 2, borderColor: colors.ink },
  cellAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  featuredCopy: { gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  intent: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2 },
  meta: { color: colors.muted, fontSize: 11 },
  gameTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 28, fontWeight: '600' },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  sectionLabel: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.4, paddingTop: 12 },
  gameRow: { minHeight: 126, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 22, padding: 16, backgroundColor: colors.surface, ...shadows.card },
  gameIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  gameCopy: { flex: 1, gap: 4 },
  rowTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingTop: 3 },
  soon: { color: colors.muted, fontSize: 11, fontWeight: '600', borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingTop: 5 },
});

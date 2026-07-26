import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { dueCards, type ReviewState } from '@/src/card-utils';
import { languageName } from '@/src/languages';
import { colors, shadows } from '@/src/theme';
import type { LearningCard } from '@/src/types';

const cardLanguageKey = 'almonium:card-language';
const reviewKey = (uid: string, language: string) => `almonium:review:${uid}:${language}`;

export default function CardsScreen() {
  const { firebaseUser, profile } = useAuth();
  const activeLanguages = useMemo(
    () => profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) ?? [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] ?? '');
  const [search, setSearch] = useState('');
  const [schedule, setSchedule] = useState<Record<string, ReviewState>>({});

  useEffect(() => {
    void AsyncStorage.getItem(cardLanguageKey).then((saved) => {
      if (saved && activeLanguages.includes(saved)) setLanguage(saved);
    });
  }, [activeLanguages]);

  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser || !language) return;
      void AsyncStorage.getItem(reviewKey(firebaseUser.uid, language)).then((value) => {
        try {
          setSchedule(value ? (JSON.parse(value) as Record<string, ReviewState>) : {});
        } catch {
          setSchedule({});
        }
      });
    }, [firebaseUser, language]),
  );

  const query = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(firebaseUser && language),
  });
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (query.data ?? []).filter(
      (card) =>
        !needle ||
        card.entry.toLocaleLowerCase().includes(needle) ||
        card.translations.some((item) => item.translation.toLocaleLowerCase().includes(needle)) ||
        card.tags?.some((tag) => tag.text?.toLocaleLowerCase().includes(needle)),
    );
  }, [query.data, search]);
  const due = dueCards(query.data ?? [], schedule).length;

  function chooseLanguage(code: string) {
    setLanguage(code);
    void AsyncStorage.setItem(cardLanguageKey, code);
  }

  function openCard(card: LearningCard) {
    router.push({ pathname: '/card/[cardId]', params: { cardId: card.id, language } });
  }

  if (!language) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="albums-outline" size={44} color={colors.primary} />
        <Text style={styles.emptyTitle}>No active study language</Text>
        <Text style={styles.emptyText}>Activate or add a target language in Settings first.</Text>
      </SafeAreaView>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(card) => card.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FLASHCARDS</Text>
          <Text style={styles.hero}>Turn new words into memory.</Text>
          {activeLanguages.length > 1 && (
            <View style={styles.chips}>
              {activeLanguages.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => chooseLanguage(code)}
                  style={[styles.chip, language === code && styles.chipActive]}>
                  <Text style={[styles.chipText, language === code && styles.chipTextActive]}>
                    {languageName(code)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.actions}>
            <Pressable
              style={styles.reviewAction}
              onPress={() => router.push({ pathname: '/review', params: { language } })}>
              <View style={styles.reviewCount}>
                <Text style={styles.reviewCountText}>{due}</Text>
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Review due cards</Text>
                <Text style={styles.actionCaption}>Spaced practice on this device</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </Pressable>
            <Button
              variant="secondary"
              onPress={() => router.push({ pathname: '/card/new', params: { language } })}>
              Add a card
            </Button>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={19} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search words, translations, or tags"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          {query.isError && query.data && (
            <Text style={styles.offline}>Showing saved cards. Reconnect to refresh or edit.</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => openCard(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>{item.entry.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.entry}>{item.entry}</Text>
            <Text style={styles.translation} numberOfLines={2}>
              {item.translations.map((translation) => translation.translation).join(' · ')}
            </Text>
            {!!item.tags?.some((tag) => tag.text) && (
              <Text style={styles.tagLine} numberOfLines={1}>
                {item.tags.filter((tag) => tag.text).map((tag) => `#${tag.text}`).join('  ')}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
      ListEmptyComponent={
        query.isLoading ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
        ) : (
          <View style={styles.emptyInline}>
            <Ionicons name="layers-outline" size={38} color={colors.primary} />
            <Text style={styles.emptyTitle}>{search ? 'No matching cards' : 'Your first word goes here'}</Text>
            <Text style={styles.emptyText}>
              {query.isError && !query.data
                ? query.error instanceof Error ? query.error.message : 'Could not load your cards.'
                : search ? 'Try a different spelling or tag.' : 'Create a card, then begin a short review.'}
            </Text>
            {!search && <Button onPress={() => router.push({ pathname: '/card/new', params: { language } })}>Create card</Button>}
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: 20, paddingBottom: 32, backgroundColor: colors.canvas },
  header: { gap: 13, paddingBottom: 20 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  hero: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.mint },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13 },
  chipTextActive: { color: colors.white },
  actions: { gap: 9 },
  reviewAction: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderRadius: 18, backgroundColor: colors.primary },
  reviewCount: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  reviewCountText: { color: colors.white, fontSize: 19, fontWeight: '900' },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  actionCaption: { color: '#dceee5', fontSize: 12 },
  search: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, gap: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  offline: { color: colors.primaryDark, fontSize: 12, fontWeight: '700', backgroundColor: colors.mint, borderRadius: 10, padding: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 19, padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadows.card },
  cardIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  cardIconText: { color: colors.primaryDark, fontSize: 19, fontWeight: '900' },
  cardCopy: { flex: 1, gap: 3 },
  entry: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  translation: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  tagLine: { color: colors.primary, fontSize: 11, fontWeight: '700', paddingTop: 2 },
  pressed: { opacity: 0.78 },
  loader: { marginTop: 50 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  emptyInline: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 20, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

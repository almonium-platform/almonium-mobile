import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { colors, fonts, shadows } from '@/src/theme';
import { intentLabel } from '@/src/review';
import type { LearningIntent, LearningItem } from '@/src/types';

const cardLanguageKey = 'almonium:card-language';
const intentFilters: ('ALL' | LearningIntent)[] = ['ALL', 'UNDERSTAND', 'PRODUCE', 'DISAMBIGUATE', 'PRONOUNCE', 'CHUNK'];

export default function CardsScreen() {
  const { firebaseUser, profile } = useAuth();
  const activeLanguages = useMemo(
    () => profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) ?? [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] ?? '');
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState<'ALL' | LearningIntent>('ALL');

  useEffect(() => {
    void AsyncStorage.getItem(cardLanguageKey).then((saved) => {
      if (saved && activeLanguages.includes(saved)) setLanguage(saved);
    });
  }, [activeLanguages]);

  const query = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(firebaseUser && language),
  });
  const review = useQuery({
    queryKey: ['review-summary', firebaseUser?.uid, language],
    queryFn: () => api.reviewSummary(language),
    enabled: Boolean(firebaseUser && language),
  });
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (query.data ?? []).filter((item) => {
      const matchesIntent = intent === 'ALL' || item.learningIntents?.includes(intent);
      const matchesSearch = !needle ||
        item.entry.toLocaleLowerCase().includes(needle) ||
        item.translations.some((translation) => translation.translation.toLocaleLowerCase().includes(needle)) ||
        item.tags?.some((tag) => tag.text?.toLocaleLowerCase().includes(needle)) ||
        item.sourceContext?.toLocaleLowerCase().includes(needle);
      return matchesIntent && matchesSearch;
    });
  }, [intent, query.data, search]);
  const due = review.data?.dueCount ?? 0;

  function chooseLanguage(code: string) {
    setLanguage(code);
    void AsyncStorage.setItem(cardLanguageKey, code);
  }

  function chooseNextLanguage() {
    if (activeLanguages.length < 2) return;
    const index = activeLanguages.indexOf(language);
    chooseLanguage(activeLanguages[(index + 1) % activeLanguages.length]);
  }

  function openItem(item: LearningItem) {
    router.push({ pathname: '/item/[itemId]', params: { itemId: item.id, language } });
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
    <View style={styles.screen}>
      <AppHeader
        language={language}
        onLanguagePress={activeLanguages.length > 1 ? chooseNextLanguage : undefined}
      />
      <FlatList
      data={filtered}
      keyExtractor={(card) => card.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching || review.isRefetching}
          onRefresh={() => Promise.all([query.refetch(), review.refetch()])}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>REVIEW</Text>
          <Text style={styles.hero}>
            {review.isLoading ? 'Gathering what is due' : due ? `${due} ${due === 1 ? 'word is' : 'words are'} due` : 'You are clear for now'}
          </Text>
          <Text style={styles.subhead}>
            {review.isLoading ? 'Your schedule is kept across every device.' : due ? `${review.data?.sessionSize ?? Math.min(10, due)} make a session. Nothing is lost by stopping.` : 'Reading a page will give Almo more to ask you.'}
          </Text>
          {review.isLoading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : due ? <View style={styles.actions}>
            <Pressable
              style={styles.reviewAction}
              onPress={() => router.push({ pathname: '/review', params: { language } })}>
              <View style={styles.reviewActionFill}>
                <View style={styles.reviewCount}>
                  <Text style={styles.reviewCountText}>{due}</Text>
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Review due items</Text>
                  <Text style={styles.actionCaption}>Your schedule follows you</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </View>
            </Pressable>
            <Button
              variant="secondary"
              onPress={() => router.push({ pathname: '/item/new', params: { language } })}>
              Add an item
            </Button>
          </View> : (
            <View style={styles.caughtUp}>
              <BrandMark size={72} />
              <View style={styles.caughtUpCopy}>
                <Text style={styles.caughtUpTitle}>Nothing due</Text>
                <Text style={styles.subhead}>Come back when the next word is ready, or meet another one in a book.</Text>
              </View>
              <Button
                variant="secondary"
                onPress={() => query.data?.length
                  ? router.push('/(tabs)/books')
                  : router.push({ pathname: '/item/new', params: { language } })}>
                {query.data?.length ? 'Open your shelf' : 'Keep your first word'}
              </Button>
            </View>
          )}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {intentFilters.map((value) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: intent === value }}
                key={value}
                onPress={() => setIntent(value)}
                style={[styles.filter, intent === value && styles.filterActive]}>
                <Text style={[styles.filterText, intent === value && styles.filterTextActive]}>
                  {value === 'ALL' ? 'All saved' : intentLabel(value)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {(query.isError || review.isError) && (query.data || review.data) && (
            <Text style={styles.offline}>Showing available review details. Reconnect to refresh the schedule.</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => openItem(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
            <Text style={styles.emptyTitle}>{search || intent !== 'ALL' ? 'No matching items' : 'Your first word goes here'}</Text>
            <Text style={styles.emptyText}>
              {query.isError && !query.data
                ? query.error instanceof Error ? query.error.message : 'Could not load your saved items.'
                : search || intent !== 'ALL' ? 'Try a different search or learning intent.' : 'Keep a word, then begin a short review.'}
            </Text>
            {!search && intent === 'ALL' && <Button onPress={() => router.push({ pathname: '/item/new', params: { language } })}>Keep a word</Button>}
          </View>
        )
      }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  list: { flexGrow: 1, padding: 16, paddingBottom: 32, backgroundColor: colors.canvas },
  header: { gap: 13, paddingBottom: 20 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  hero: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, fontWeight: '600' },
  subhead: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  actions: { gap: 9 },
  caughtUp: { alignItems: 'center', gap: 11, padding: 18, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  caughtUpCopy: { alignItems: 'center', gap: 3 },
  caughtUpTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22 },
  reviewAction: { minHeight: 70, borderRadius: 999, overflow: 'hidden' },
  reviewActionFill: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: colors.primary },
  reviewCount: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  reviewCountText: { color: colors.white, fontSize: 19, fontWeight: '600' },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { color: colors.white, fontSize: 16, fontWeight: '600' },
  actionCaption: { color: colors.white, fontSize: 12, opacity: 0.84 },
  search: { minHeight: 50, borderRadius: 999, paddingHorizontal: 16, gap: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, ...shadows.field },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  filters: { gap: 7, paddingRight: 4 },
  filter: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 13, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: colors.primary },
  offline: { color: colors.primaryDark, fontSize: 12, fontWeight: '600', backgroundColor: colors.accentSoft, borderRadius: 10, padding: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 20, padding: 15, backgroundColor: colors.surface, ...shadows.card },
  cardIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  cardIconText: { color: colors.primaryDark, fontSize: 19, fontWeight: '600' },
  cardCopy: { flex: 1, gap: 3 },
  entry: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  translation: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  tagLine: { color: colors.primary, fontSize: 11, fontWeight: '600', paddingTop: 2 },
  pressed: { opacity: 0.78 },
  loader: { marginTop: 50 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  emptyInline: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { color: colors.ink, fontWeight: '600', fontSize: 20, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

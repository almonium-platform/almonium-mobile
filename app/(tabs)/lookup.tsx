import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { PaywallModal, type PaywallContext } from '@/components/paywall-modal';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { createCardDraft } from '@/src/card-utils';
import { normalizedLookupEntry, tokenizeSentence, type DiscoverLookup } from '@/src/discover';
import { languageName } from '@/src/languages';
import { freeSavedItemLimit } from '@/src/limits';
import { colors, fonts, shadows } from '@/src/theme';

const lookupLanguageKey = 'almonium:lookup-language';

export default function LookupScreen() {
  const params = useLocalSearchParams<{ text?: string }>();
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const activeLanguages = useMemo(
    () => profile?.learners.filter((learner) => learner.active).map((learner) => learner.language) ?? [],
    [profile?.learners],
  );
  const [language, setLanguage] = useState(activeLanguages[0] ?? 'EN');
  const [search, setSearch] = useState('');
  const [context, setContext] = useState('');
  const [tokens, setTokens] = useState<string[]>([]);
  const [lookup, setLookup] = useState<DiscoverLookup | null>(null);
  const [senseIndex, setSenseIndex] = useState(0);
  const [produce, setProduce] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [paywallContext, setPaywallContext] = useState<PaywallContext | null>(null);
  const handledSharedText = useRef('');

  useEffect(() => {
    void AsyncStorage.getItem(lookupLanguageKey).then((stored) => {
      if (stored && activeLanguages.includes(stored)) setLanguage(stored);
    });
  }, [activeLanguages]);

  const translationLanguage =
    profile?.fluentLangs.find((code) => code !== language) ?? (language === 'EN' ? 'UK' : 'EN');
  const selectedSense = lookup?.senses[senseIndex];
  const itemsQuery = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(firebaseUser && language),
  });

  const lookupMutation = useMutation({
    mutationFn: ({ entry, sourceContext }: { entry: string; sourceContext?: string }) =>
      api.discover(entry, language, translationLanguage, sourceContext),
    onSuccess: (result) => {
      setLookup(result);
      setSenseIndex(0);
      setSaved(false);
      setProduce(false);
      setHistory((current) => [result.entry, ...current.filter((item) => item !== result.entry)].slice(0, 6));
    },
  });

  useEffect(() => {
    const sharedText = typeof params.text === 'string' ? params.text.trim().slice(0, 500) : '';
    if (!sharedText || handledSharedText.current === sharedText) return;
    handledSharedText.current = sharedText;
    setSearch(sharedText);
    const sharedTokens = tokenizeSentence(sharedText);
    if (sharedTokens.length > 1) {
      setContext(sharedText);
      setTokens(sharedTokens);
    } else {
      const entry = normalizedLookupEntry(sharedTokens[0] ?? sharedText);
      if (entry) lookupMutation.mutate({ entry });
    }
  }, [lookupMutation, params.text]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!lookup || !selectedSense) return;
      const draft = createCardDraft(
        selectedSense.headword || lookup.entry,
        lookup.language,
        selectedSense.translations.join('\n'),
        '',
        '',
      );
      if (lookup.sourceContext) draft.examples = [{ example: lookup.sourceContext }];
      draft.partOfSpeech = selectedSense.partOfSpeech || undefined;
      draft.selectedSense = `${selectedSense.index}: ${selectedSense.translations.join(', ')}`;
      draft.sourceContext = lookup.sourceContext || undefined;
      draft.learningIntents = produce ? ['UNDERSTAND', 'PRODUCE'] : ['UNDERSTAND'];
      await api.createCard(draft);
    },
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['cards', firebaseUser?.uid] });
    },
  });

  function chooseLanguage(next: string) {
    setLanguage(next);
    setLookup(null);
    setTokens([]);
    setContext('');
    void AsyncStorage.setItem(lookupLanguageKey, next);
  }

  function submit() {
    const input = search.trim().replace(/\s+/g, ' ');
    if (!input) return;
    Keyboard.dismiss();
    const nextTokens = tokenizeSentence(input);
    if (nextTokens.length > 1) {
      setContext(input);
      setTokens(nextTokens);
      setLookup(null);
      return;
    }
    openWord(nextTokens[0] ?? input);
  }

  function keepWord() {
    if (!profile?.premium && (itemsQuery.data?.length ?? 0) >= freeSavedItemLimit) {
      setPaywallContext('item-cap');
      return;
    }
    saveMutation.mutate();
  }

  function openWord(value: string, sourceContext?: string) {
    const entry = normalizedLookupEntry(value);
    if (!entry) return;
    setSearch(entry);
    lookupMutation.mutate({ entry, sourceContext });
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        language={language}
        onLanguageChange={activeLanguages.length > 1 ? chooseLanguage : undefined}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>LOOK UP</Text>
          <Text style={styles.title}>A word, or a whole sentence</Text>
          <Text style={styles.subhead}>
            Paste anything {languageName(language)} and tap what you don’t know.
          </Text>
        </View>

        <View style={styles.searchField}>
          <Ionicons name="search" size={19} color={colors.metadata} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={submit}
            placeholder="Word, phrase or sentence"
            placeholderTextColor={colors.metadata}
            returnKeyType="search"
            multiline
            maxLength={500}
            style={styles.input}
          />
          {!!search && (
            <Pressable accessibilityLabel="Clear lookup" hitSlop={10} onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={colors.metadata} />
            </Pressable>
          )}
        </View>
        <Button disabled={!search.trim() || lookupMutation.isPending} onPress={submit}>
          {lookupMutation.isPending ? 'Opening…' : 'Look up'}
        </Button>

        {tokens.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>YOUR SENTENCE</Text>
            <View style={styles.tokens}>
              {tokens.map((token, index) => {
                const active = lookup?.entry.toLocaleLowerCase() === token.toLocaleLowerCase();
                return (
                  <Pressable
                    key={`${token}-${index}`}
                    onPress={() => openWord(token, context)}
                    style={[styles.token, active && styles.tokenActive]}>
                    <Text style={[styles.tokenText, active && styles.tokenTextActive]}>{token}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>Tap a word to open its dictionary sheet.</Text>
          </View>
        )}

        {lookupMutation.isPending && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.subhead}>Opening the entry…</Text>
          </View>
        )}

        {lookupMutation.isError && (
          <View style={styles.error}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
            <Text style={styles.errorText}>
              {lookupMutation.error instanceof Error
                ? lookupMutation.error.message
                : 'This word sheet could not be loaded.'}
            </Text>
          </View>
        )}

        {lookup && !lookupMutation.isPending && (
          <View style={styles.wordSheet}>
            <View style={styles.entryHeading}>
              <View style={styles.entryCopy}>
                <Text style={styles.entry}>{selectedSense?.headword || lookup.entry}</Text>
                <Text style={styles.entryMeta}>
                  {selectedSense?.partOfSpeech || 'word'}
                  {selectedSense?.transcription ? ` · /${selectedSense.transcription}/` : ''}
                  {lookup.frequency ? ` · ${lookup.frequency.band}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Learn about premium audio"
                onPress={() => setPaywallContext('audio')}
                style={styles.audioButton}>
                <Ionicons name="volume-medium-outline" size={20} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.senses}>
              {lookup.senses.length ? (
                lookup.senses.map((sense, index) => (
                  <Pressable
                    key={`${sense.index}-${sense.headword}`}
                    onPress={() => {
                      setSenseIndex(index);
                      setSaved(false);
                    }}
                    style={[styles.sense, index > 0 && styles.senseDivider]}>
                    <Text style={[styles.senseNumber, index !== senseIndex && styles.senseNumberMuted]}>
                      {sense.index}
                    </Text>
                    <View style={styles.senseCopy}>
                      <Text style={[styles.meaning, index !== senseIndex && styles.meaningMuted]}>
                        {sense.translations.join(', ') || 'Meaning not supplied'}
                      </Text>
                      {index === senseIndex && lookup.sourceContext && (
                        <Text style={styles.context}>“{lookup.sourceContext}”</Text>
                      )}
                    </View>
                    <Ionicons
                      name={index === senseIndex ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={index === senseIndex ? colors.primary : colors.border}
                    />
                  </Pressable>
                ))
              ) : (
                <Text style={styles.subhead}>No structured dictionary sense is available yet.</Text>
              )}
            </View>

            <View style={styles.intentRow}>
              <View style={styles.intentSelected}><Text style={styles.intentSelectedText}>Understand it</Text></View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: produce, disabled: saved }}
                disabled={saved}
                onPress={() => setProduce((value) => !value)}
                style={[produce ? styles.intentSelected : styles.intent, saved && styles.intentDisabled]}>
                <Text style={produce ? styles.intentSelectedText : styles.intentText}>Say it too</Text>
              </Pressable>
            </View>
            <Button
              disabled={!selectedSense?.translations.length || saveMutation.isPending || saved}
              onPress={keepWord}>
              {saved ? 'Kept' : saveMutation.isPending ? 'Keeping…' : 'Keep this word'}
            </Button>
            {saveMutation.isError && (
              <Text style={styles.saveError}>The word could not be kept. Please try again.</Text>
            )}
            <Text style={styles.provider}>
              {lookup.provider ? `Dictionary provider: ${lookup.provider}` : 'Dictionary provenance unavailable'}
            </Text>
          </View>
        )}

        {!!history.length && (
          <View style={styles.history}>
            <Text style={styles.eyebrow}>LOOKED UP EARLIER</Text>
            <View style={styles.historyChips}>
              {history.map((item) => (
                <Pressable key={item} onPress={() => openWord(item)} style={styles.historyChip}>
                  <Text style={styles.historyText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <PaywallModal
        context={paywallContext ?? 'general'}
        visible={Boolean(paywallContext)}
        onClose={() => setPaywallContext(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  intro: { gap: 5 },
  eyebrow: { color: colors.raspberry, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 28, lineHeight: 34 },
  subhead: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20 },
  searchField: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    backgroundColor: colors.surface,
    ...shadows.field,
  },
  input: { flex: 1, maxHeight: 96, paddingVertical: 12, color: colors.ink, fontFamily: fonts.sans, fontSize: 15 },
  card: { gap: 12, padding: 18, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  token: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 5, borderBottomWidth: 1.5, borderBottomColor: colors.metadata },
  tokenActive: { borderBottomColor: colors.primary, backgroundColor: colors.accentSoft, borderRadius: 5 },
  tokenText: { color: colors.ink, fontFamily: fonts.serifRegular, fontSize: 18 },
  tokenTextActive: { color: colors.primary },
  hint: { color: colors.metadata, fontSize: 12 },
  loading: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  wordSheet: { gap: 15, padding: 18, borderRadius: 24, backgroundColor: colors.surface, ...shadows.card },
  entryHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryCopy: { flex: 1, gap: 4 },
  entry: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 37 },
  entryMeta: { color: colors.metadata, fontFamily: fonts.sans, fontSize: 12 },
  audioButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22 },
  senses: { paddingHorizontal: 2 },
  sense: { minHeight: 66, flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  senseDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  senseNumber: { minWidth: 18, paddingTop: 2, color: colors.primary, fontSize: 12 },
  senseNumberMuted: { color: colors.metadata },
  senseCopy: { flex: 1, gap: 5 },
  meaning: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22 },
  meaningMuted: { color: colors.muted, fontFamily: fonts.sans },
  context: { color: colors.muted, fontFamily: fonts.serifRegular, fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
  intentRow: { flexDirection: 'row', gap: 8 },
  intentSelected: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 22, backgroundColor: colors.accentSoft },
  intent: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22 },
  intentSelectedText: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 14 },
  intentText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 14 },
  intentDisabled: { opacity: 0.55 },
  saveError: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  provider: { color: colors.metadata, fontSize: 10.5, textAlign: 'center' },
  history: { gap: 9, marginTop: 3 },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 19, backgroundColor: colors.surface },
  historyText: { color: colors.ink, fontFamily: fonts.serifRegular, fontSize: 14.5 },
});

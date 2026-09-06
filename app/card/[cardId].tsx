import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { PaywallModal } from '@/components/paywall-modal';
import { Button, Card, Field } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { createCardDraft } from '@/src/card-utils';
import { languageName } from '@/src/languages';
import { freeSavedItemLimit } from '@/src/limits';
import { intentLabel } from '@/src/review';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';
import type { LearningIntent } from '@/src/types';

const intents: LearningIntent[] = ['UNDERSTAND', 'PRODUCE', 'DISAMBIGUATE', 'PRONOUNCE', 'CHUNK'];

/**
 * An item is read on the phone and edited on the web: editing senses and translations wants a
 * keyboard and two panes. Here the detail shows what is known, the intents can be adjusted, and
 * the item can be removed. Creating a word by hand keeps the small form.
 */
export default function LearningItemScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { cardId, itemId, language: languageParam } = useLocalSearchParams<{ cardId?: string; itemId?: string; language: string }>();
  const resolvedItemId = itemId || cardId;
  const editing = Boolean(resolvedItemId && resolvedItemId !== 'new');
  const language = languageParam || '';
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState('');
  const [translations, setTranslations] = useState('');
  const [learningIntents, setLearningIntents] = useState<LearningIntent[]>(['UNDERSTAND']);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showItemCap, setShowItemCap] = useState(false);
  const cardQuery = useQuery({
    queryKey: ['card', firebaseUser?.uid, resolvedItemId],
    queryFn: () => api.card(resolvedItemId as string),
    enabled: Boolean(editing && firebaseUser),
  });
  const itemsQuery = useQuery({
    queryKey: ['cards', firebaseUser?.uid, language],
    queryFn: () => api.cards(language),
    enabled: Boolean(!editing && firebaseUser && language),
  });

  useEffect(() => {
    const card = cardQuery.data;
    if (card) setLearningIntents(card.learningIntents?.length ? card.learningIntents : ['UNDERSTAND']);
  }, [cardQuery.data]);

  async function create() {
    const draft = createCardDraft(entry, language, translations, '', '');
    draft.learningIntents = learningIntents;
    if (!draft.entry || !draft.translations.length) return;
    if (!profile?.premium && (itemsQuery.data?.length ?? 0) >= freeSavedItemLimit) {
      setShowItemCap(true);
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      await api.createCard(draft);
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The item could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveIntents(next: LearningIntent[]) {
    const card = cardQuery.data;
    if (!card) return;
    setLearningIntents(next);
    try {
      await api.updateCard(card.id, card.language, { learningIntents: next });
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The intent could not be changed.');
    }
  }

  async function confirmRemove() {
    if (!cardQuery.data) return;
    setSaving(true);
    setErrorMessage('');
    try {
      await api.deleteCard(cardQuery.data.id);
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The item could not be deleted. Try again.');
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  }

  if (cardQuery.isError) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.errorTitle}>This word could not be opened</Text>
        <Text style={styles.caption}>{cardQuery.error instanceof Error ? cardQuery.error.message : 'Check your connection.'}</Text>
        <Button onPress={() => cardQuery.refetch()}>Try again</Button>
      </Screen>
    );
  }

  const card = cardQuery.data;

  if (!editing) {
    const valid = Boolean(entry.trim() && translations.trim() && language);
    return (
      <Screen>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>KEEP A WORD</Text>
          <Text style={styles.title}>Save a word worth remembering.</Text>
          <Text style={styles.caption}>{languageName(language)} · usually you meet it in a book or paste it into Look up.</Text>
        </View>
        <Card>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Word or phrase</Text>
            <Field value={entry} onChangeText={setEntry} placeholder="verlassen" autoCapitalize="sentences" maxLength={200} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Meaning</Text>
            <Text style={styles.caption}>One translation per line.</Text>
            <Field value={translations} onChangeText={setTranslations} placeholder={'to leave\nto abandon'} autoCapitalize="sentences" multiline textAlignVertical="top" style={styles.multiline} />
          </View>
          <IntentRow value={learningIntents} onChange={setLearningIntents} />
        </Card>
        {!!errorMessage && <View accessibilityRole="alert" style={styles.errorSurface}><Text style={styles.errorText}>{errorMessage}</Text></View>}
        <Button loading={saving} disabled={!valid} onPress={() => void create()}>Keep this word</Button>
        <PaywallModal context="item-cap" visible={showItemCap} onClose={() => setShowItemCap(false)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </Pressable>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{languageName(card?.language ?? language).toUpperCase()}{card?.partOfSpeech ? ` · ${card.partOfSpeech.toUpperCase()}` : ''}</Text>
        <Text style={styles.entry}>{card?.entry ?? '…'}</Text>
        {!!card?.createdAt && (
          <Text style={styles.caption}>
            Kept {new Date(card.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
            {card.iteration ? ` · seen ${card.iteration}×` : ''}
          </Text>
        )}
      </View>

      {card && (
        <>
          <View style={styles.plate}>
            {card.translations.map((translation, index) => (
              <View key={translation.id ?? index} style={[styles.sense, index > 0 && styles.senseDivider]}>
                <Text style={styles.senseIndex}>{index + 1}</Text>
                <Text style={styles.senseText}>{translation.translation}</Text>
              </View>
            ))}
            {!!card.selectedSense && <Text style={styles.senseNote}>Sense kept: {card.selectedSense}</Text>}
          </View>

          {(!!card.sourceContext || !!card.examples?.length) && (
            <View style={styles.section}>
              <Text style={styles.eyebrow}>WHERE YOU MET IT</Text>
              {!!card.sourceContext && <Text style={styles.context}>„{card.sourceContext}“</Text>}
              {card.examples?.filter((example) => example.example !== card.sourceContext).map((example, index) => (
                <Text key={example.id ?? index} style={styles.context}>„{example.example}“</Text>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.eyebrow}>WHAT YOU WANT FROM IT</Text>
            <IntentRow value={learningIntents} onChange={(next) => void saveIntents(next)} />
          </View>

          {(card.falseFriend || card.irregularPlural || card.irregularSpelling) && (
            <View style={styles.section}>
              <Text style={styles.eyebrow}>WATCH OUT</Text>
              <Text style={styles.caption}>
                {[card.falseFriend && 'false friend', card.irregularPlural && 'irregular plural', card.irregularSpelling && 'irregular spelling'].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          <Text style={styles.caption}>Editing senses and translations happens on the web, where there is room for two panes.</Text>
          {!!errorMessage && <View accessibilityRole="alert" style={styles.errorSurface}><Text style={styles.errorText}>{errorMessage}</Text></View>}
          {confirmingDelete ? (
            <View style={styles.deleteConfirm}>
              <Text style={styles.deleteTitle}>Remove “{card.entry}”?</Text>
              <Text style={styles.caption}>Its review history goes with it.</Text>
              <Button variant="destructive" loading={saving} onPress={() => void confirmRemove()}>Remove</Button>
              <Button variant="secondary" disabled={saving} onPress={() => setConfirmingDelete(false)}>Keep it</Button>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmingDelete(true)} style={styles.deleteLink}>
              <Text style={styles.deleteText}>Remove this word</Text>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}

function IntentRow({ value, onChange }: { value: LearningIntent[]; onChange(next: LearningIntent[]): void }) {
  const styles = useStyles();
  return (
    <View style={styles.intents}>
      {intents.map((intent) => {
        const selected = value.includes(intent);
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            key={intent}
            onPress={() =>
              onChange(selected ? (value.length === 1 ? value : value.filter((entry) => entry !== intent)) : [...value, intent])
            }
            style={[styles.intent, selected && styles.intentActive]}>
            <Text style={[styles.intentText, selected && styles.intentTextActive]}>{intentLabel(intent)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  heading: { gap: 6, paddingVertical: 3 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 27, lineHeight: 34, fontWeight: '600' },
  entry: { color: colors.ink, fontFamily: fonts.serif, fontSize: 34, lineHeight: 40 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  fieldGroup: { gap: 7 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  multiline: { minHeight: 112, paddingTop: 14 },
  plate: { borderRadius: 24, paddingHorizontal: 18, paddingVertical: 6, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 }) },
  sense: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  senseDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  senseIndex: { width: 16, color: colors.primary, fontSize: 12, paddingTop: 3 },
  senseText: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 23 },
  senseNote: { color: colors.metadata, fontSize: 12, paddingBottom: 10 },
  section: { gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  context: { color: colors.reader, fontFamily: fonts.serifRegular, fontSize: 15, lineHeight: 23 },
  intents: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  intent: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 12 },
  intentActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  intentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  intentTextActive: { color: colors.primary },
  errorSurface: { borderRadius: 16, padding: 14, backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  deleteConfirm: { gap: 10, borderRadius: 20, padding: 16, backgroundColor: colors.nested },
  deleteTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  deleteLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  center: { justifyContent: 'center' },
  errorTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
}));

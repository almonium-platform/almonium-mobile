import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { PaywallModal } from '@/components/paywall-modal';
import { Button, Card, Field } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { cardUpdate, createCardDraft } from '@/src/card-utils';
import { languageName } from '@/src/languages';
import { freeSavedItemLimit } from '@/src/limits';
import { intentLabel } from '@/src/review';
import { createThemedStyles, fonts } from '@/src/theme';
import type { LearningIntent } from '@/src/types';

const intents: LearningIntent[] = ['UNDERSTAND', 'PRODUCE', 'DISAMBIGUATE', 'PRONOUNCE', 'CHUNK'];

export default function CardEditorScreen() {
  const styles = useStyles();
  const { cardId, itemId, language: languageParam } = useLocalSearchParams<{
    cardId?: string;
    itemId?: string;
    language: string;
  }>();
  const resolvedItemId = itemId || cardId;
  const editing = Boolean(resolvedItemId && resolvedItemId !== 'new');
  const language = languageParam || '';
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState('');
  const [translations, setTranslations] = useState('');
  const [tags, setTags] = useState('');
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
    if (!card) return;
    setEntry(card.entry);
    setTranslations(card.translations.map((translation) => translation.translation).join('\n'));
    setTags(card.tags?.filter((tag) => tag.text).map((tag) => tag.text).join(', ') ?? '');
    setLearningIntents(card.learningIntents?.length ? card.learningIntents : ['UNDERSTAND']);
  }, [cardQuery.data]);

  const draft = createCardDraft(entry, language || cardQuery.data?.language || '', translations, '', tags);
  draft.learningIntents = learningIntents;
  draft.partOfSpeech = cardQuery.data?.partOfSpeech;
  draft.selectedSense = cardQuery.data?.selectedSense;
  draft.sourceContext = cardQuery.data?.sourceContext;
  const valid = Boolean(draft.entry && draft.language && draft.translations.length);

  async function save() {
    if (!valid) return;
    if (!editing && !profile?.premium && (itemsQuery.data?.length ?? 0) >= freeSavedItemLimit) {
      setShowItemCap(true);
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      if (editing && cardQuery.data) {
        await api.updateCard(cardQuery.data.id, cardQuery.data.language, cardUpdate(cardQuery.data, draft));
      } else {
        await api.createCard(draft);
      }
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The item could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!cardQuery.data) return;
    setConfirmingDelete(true);
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
        <Text style={styles.errorTitle}>This learning item could not be opened</Text>
        <Text style={styles.caption}>
          {cardQuery.error instanceof Error ? cardQuery.error.message : 'Check your connection.'}
        </Text>
        <Button onPress={() => cardQuery.refetch()}>Try again</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{editing ? 'LEARNING ITEM' : 'NEW ITEM'}</Text>
        <Text style={styles.title}>{editing ? 'Refine this word.' : 'Save a word worth remembering.'}</Text>
        <Text style={styles.caption}>{languageName(language || cardQuery.data?.language || '')}</Text>
      </View>
      <Card>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Word or phrase</Text>
          <Field
            value={entry}
            onChangeText={setEntry}
            placeholder="bonjour"
            autoCapitalize="sentences"
            maxLength={200}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Translations</Text>
          <Text style={styles.caption}>Put each translation on a new line.</Text>
          <Field
            value={translations}
            onChangeText={setTranslations}
            placeholder={'hello\ngood morning'}
            autoCapitalize="sentences"
            multiline
            textAlignVertical="top"
            style={styles.multiline}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tags</Text>
          <Field
            value={tags}
            onChangeText={setTags}
            placeholder="greeting, travel"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Learning intent</Text>
          <View style={styles.intents}>
            {intents.map((intent) => {
              const selected = learningIntents.includes(intent);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={intent}
                  onPress={() => setLearningIntents((current) =>
                    selected
                      ? current.length === 1 ? current : current.filter((value) => value !== intent)
                      : [...current, intent],
                  )}
                  style={[styles.intent, selected && styles.intentActive]}>
                  <Text style={[styles.intentText, selected && styles.intentTextActive]}>{intentLabel(intent)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {!!cardQuery.data?.selectedSense && (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>SENSE</Text>
            <Text style={styles.detailText}>{cardQuery.data.selectedSense}</Text>
          </View>
        )}
        {!!cardQuery.data?.sourceContext && (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>FIRST ENCOUNTER</Text>
            <Text style={styles.context}>“{cardQuery.data.sourceContext}”</Text>
          </View>
        )}
        {!!cardQuery.data?.createdAt && (
          <Text style={styles.caption}>Kept {new Date(cardQuery.data.createdAt).toLocaleDateString()}</Text>
        )}
      </Card>
      {!!errorMessage && <View accessibilityRole="alert" style={styles.errorSurface}><Text style={styles.errorText}>{errorMessage}</Text></View>}
      <Button loading={saving} disabled={!valid || cardQuery.isLoading} onPress={save}>
        {editing ? 'Save changes' : 'Keep this item'}
      </Button>
      {editing && (
        confirmingDelete ? (
          <View style={styles.deleteConfirm}>
            <Text style={styles.deleteTitle}>Remove “{cardQuery.data?.entry}”?</Text>
            <Text style={styles.caption}>Its review history will be removed permanently.</Text>
            <Button variant="danger" loading={saving} onPress={confirmRemove}>Delete permanently</Button>
            <Button variant="secondary" disabled={saving} onPress={() => setConfirmingDelete(false)}>Keep item</Button>
          </View>
        ) : (
          <Button variant="danger" disabled={saving || !cardQuery.data} onPress={remove}>Delete item</Button>
        )
      )}
      <PaywallModal context="item-cap" visible={showItemCap} onClose={() => setShowItemCap(false)} />
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  heading: { gap: 5, paddingVertical: 3 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.4 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 27, lineHeight: 34, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  fieldGroup: { gap: 7 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  multiline: { minHeight: 112, paddingTop: 14 },
  intents: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  intent: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 12 },
  intentActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  intentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  intentTextActive: { color: colors.primary },
  detailBlock: { gap: 5, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 13 },
  detailLabel: { color: colors.primary, fontSize: 10, fontWeight: '600', letterSpacing: 1.3 },
  detailText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  context: { color: colors.muted, fontFamily: fonts.serifRegular, fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
  errorSurface: { borderRadius: 16, padding: 14, backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  deleteConfirm: { gap: 10, borderRadius: 20, padding: 16, backgroundColor: colors.dangerSoft },
  deleteTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  center: { justifyContent: 'center' },
  errorTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
}));

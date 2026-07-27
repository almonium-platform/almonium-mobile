import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Field } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { cardUpdate, createCardDraft } from '@/src/card-utils';
import { languageName } from '@/src/languages';
import { colors, fonts } from '@/src/theme';

export default function CardEditorScreen() {
  const { cardId, language: languageParam } = useLocalSearchParams<{
    cardId?: string;
    language: string;
  }>();
  const editing = Boolean(cardId && cardId !== 'new');
  const language = languageParam || '';
  const { firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState('');
  const [translations, setTranslations] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const cardQuery = useQuery({
    queryKey: ['card', firebaseUser?.uid, cardId],
    queryFn: () => api.card(cardId as string),
    enabled: Boolean(editing && firebaseUser),
  });

  useEffect(() => {
    const card = cardQuery.data;
    if (!card) return;
    setEntry(card.entry);
    setTranslations(card.translations.map((translation) => translation.translation).join('\n'));
    setTags(card.tags?.filter((tag) => tag.text).map((tag) => tag.text).join(', ') ?? '');
  }, [cardQuery.data]);

  const draft = createCardDraft(entry, language || cardQuery.data?.language || '', translations, '', tags);
  const valid = Boolean(draft.entry && draft.language && draft.translations.length);

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      if (editing && cardQuery.data) {
        await api.updateCard(cardQuery.data.id, cardQuery.data.language, cardUpdate(cardQuery.data, draft));
      } else {
        await api.createCard(draft);
      }
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.back();
    } catch (error) {
      Alert.alert('Could not save card', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!cardQuery.data) return;
    Alert.alert('Delete this card?', `"${cardQuery.data.entry}" will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCard(cardQuery.data.id);
            await queryClient.invalidateQueries({ queryKey: ['cards'] });
            router.back();
          } catch (error) {
            Alert.alert('Could not delete card', error instanceof Error ? error.message : 'Try again.');
          }
        },
      },
    ]);
  }

  if (cardQuery.isError) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.errorTitle}>This card could not be opened</Text>
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
        <Text style={styles.eyebrow}>{editing ? 'EDIT CARD' : 'NEW CARD'}</Text>
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
      </Card>
      <Button loading={saving} disabled={!valid || cardQuery.isLoading} onPress={save}>
        {editing ? 'Save changes' : 'Create card'}
      </Button>
      {editing && (
        <Button variant="danger" disabled={saving || !cardQuery.data} onPress={remove}>
          Delete card
        </Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 5, paddingVertical: 3 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.4 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 27, lineHeight: 34, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  fieldGroup: { gap: 7 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  multiline: { minHeight: 112, paddingTop: 14 },
  center: { justifyContent: 'center' },
  errorTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
});

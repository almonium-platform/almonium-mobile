import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarMark } from '@/components/avatar-mark';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { config } from '@/src/config';
import { lightImpact } from '@/src/haptics';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, shadows, useTheme } from '@/src/theme';
import type { SharedWord, Sharer } from '@/src/types';

/**
 * A shared word or pack, opened from a link. Same public preview as the web, then add all or
 * pick. Signed out, the preview still reads and the add routes through sign-in.
 */
export function SharedLinkScreen({ kind, id }: { kind: 'card' | 'deck'; id: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile } = useAuth();
  const showNotice = useNotice();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);

  const view = useQuery({
    queryKey: ['shared', kind, id],
    queryFn: async () => {
      if (kind === 'card') {
        const card = await api.publicSharedCard(id);
        return { status: 'ACTIVE' as const, title: null, language: card.language, words: [card.word], sharer: card.sharer as Sharer | null };
      }
      return api.publicSharedDeck(id);
    },
  });
  const viewer = useQuery({
    queryKey: ['shared-viewer', kind, id, firebaseUser?.uid],
    queryFn: () => (kind === 'card' ? api.sharedCardViewer(id) : api.sharedDeckViewer(id)),
    enabled: Boolean(firebaseUser && view.data?.status === 'ACTIVE'),
  });
  const add = useMutation({
    mutationFn: (wordIds: string[]) => (kind === 'card' ? api.addSharedCard(id) : api.addFromSharedDeck(id, wordIds)),
    onSuccess: async (result) => {
      lightImpact();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cards'] }),
        queryClient.invalidateQueries({ queryKey: ['shared-viewer'] }),
      ]);
      showNotice({
        title: result.added === 1 ? 'One word kept' : `${result.added} words kept`,
        message: result.alreadyHeld ? `${result.alreadyHeld} you already had.` : 'They join your review schedule.',
        tone: 'success',
      });
      setPicking(false);
      setPicked(new Set());
    },
    onError: (error) => showNotice({ title: 'Could not add', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' }),
  });

  const words = view.data?.words ?? [];
  const held = new Set(viewer.data?.heldWordIds ?? []);
  const fresh = words.filter((word) => !held.has(word.id));
  useEffect(() => setPicked(new Set(fresh.map((word) => word.id))), [viewer.data?.heldWordIds, words.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (view.isLoading) {
    return <View style={styles.center}><Text style={styles.copy}>Opening the link…</Text></View>;
  }
  if (view.isError || !view.data || view.data.status !== 'ACTIVE') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="link-outline" size={40} color={colors.primary} />
        <Text style={styles.title}>This link has nothing behind it</Text>
        <Text style={styles.copy}>{view.data?.status === 'REVOKED' ? 'The person who shared it took it back.' : 'It may have been deleted, or never existed.'}</Text>
        <Button onPress={() => router.replace('/')}>Open Almonium</Button>
      </SafeAreaView>
    );
  }

  const language = view.data.language ?? '';
  const sharer = view.data.sharer;
  const signedIn = Boolean(firebaseUser && profile);
  const canAdd = signedIn && viewer.data && !viewer.data.owner && fresh.length > 0;
  const noLearner = signedIn && viewer.data && !viewer.data.hasLearner;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{kind === 'card' ? 'A SHARED WORD' : 'A SHARED PACK'} · {languageName(language).toUpperCase()}</Text>
          <Text style={styles.title}>{kind === 'card' ? words[0]?.entry : view.data.title ?? 'Word pack'}</Text>
          {!!sharer && (
            <View style={styles.sharer}>
              <AvatarMark avatarUrl={sharer.avatarUrl} username={sharer.username} premium={sharer.premium} size={28} />
              <Text style={styles.copy}>Shared by @{sharer.username}</Text>
            </View>
          )}
        </View>

        <View style={styles.list}>
          {words.map((word, index) => {
            const already = held.has(word.id);
            const selected = picked.has(word.id);
            return (
              <Pressable
                key={word.id}
                disabled={!picking || already}
                onPress={() =>
                  setPicked((current) => {
                    const next = new Set(current);
                    if (next.has(word.id)) next.delete(word.id);
                    else next.add(word.id);
                    return next;
                  })
                }
                style={[styles.word, index > 0 && styles.wordDivider]}>
                <WordBody word={word} />
                {already ? (
                  <Text style={styles.held}>Kept</Text>
                ) : picking ? (
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.border} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {!signedIn ? (
          <>
            <Button onPress={() => router.push('/(auth)/sign-in')}>Sign in to keep {words.length === 1 ? 'it' : 'them'}</Button>
            <Text style={styles.copy}>Reading is free. Signing in keeps these words in your own review schedule.</Text>
          </>
        ) : viewer.data?.owner ? (
          <Text style={styles.copy}>This is your own {kind === 'card' ? 'word' : 'pack'}. Anyone with the link sees this page.</Text>
        ) : noLearner ? (
          <>
            <Text style={styles.copy}>You are not learning {languageName(language)} yet. Add it in Settings and these words can join your shelf.</Text>
            <Button variant="secondary" onPress={() => router.push('/(tabs)/settings')}>Open settings</Button>
          </>
        ) : !canAdd ? (
          <Text style={styles.copy}>{fresh.length === 0 && words.length ? 'You already keep every word here.' : ''}</Text>
        ) : picking ? (
          <>
            <Button loading={add.isPending} disabled={!picked.size} onPress={() => add.mutate([...picked])}>
              Keep {picked.size} {picked.size === 1 ? 'word' : 'words'}
            </Button>
            <Pressable onPress={() => setPicking(false)} style={styles.inlineAction}><Text style={styles.link}>Cancel</Text></Pressable>
          </>
        ) : (
          <>
            <Button loading={add.isPending} onPress={() => add.mutate(fresh.map((word) => word.id))}>
              {kind === 'card' ? 'Keep this word' : `Add all ${fresh.length}`}
            </Button>
            {kind === 'deck' && fresh.length > 1 && (
              <Pressable onPress={() => setPicking(true)} style={styles.inlineAction}><Text style={styles.link}>Pick which ones</Text></Pressable>
            )}
          </>
        )}
        <Pressable onPress={() => void Linking.openURL(`${config.webBaseUrl}/${kind === 'card' ? 'c' : 'd'}/${encodeURIComponent(id)}`)} style={styles.inlineAction}>
          <Text style={styles.metaLink}>Open on the web</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function WordBody({ word }: { word: SharedWord }) {
  const styles = useStyles();
  return (
    <View style={styles.wordCopy}>
      <View style={styles.wordLine}>
        <Text style={styles.entry}>{word.entry}</Text>
        {!!word.partOfSpeech && <Text style={styles.meta}>{word.partOfSpeech.toLowerCase()}</Text>}
      </View>
      <Text style={styles.translation}>{word.translations.join(', ')}</Text>
      {!!word.sourceContext && <Text style={styles.context}>„{word.sourceContext}“</Text>}
    </View>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: colors.canvas },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  heading: { gap: 8 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, fontWeight: '600' },
  sharer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { borderRadius: 24, paddingHorizontal: 16, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  word: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  wordDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  wordCopy: { flex: 1, gap: 3 },
  wordLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  entry: { color: colors.primaryDark, fontFamily: fonts.serif, fontSize: 19 },
  meta: { color: colors.metadata, fontSize: 11 },
  translation: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  context: { color: colors.muted, fontFamily: fonts.serifRegular, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  held: { color: colors.success, fontSize: 12, fontWeight: '600' },
  inlineAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  metaLink: { color: colors.metadata, fontSize: 13 },
}));

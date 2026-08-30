import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { ReadingProgressSync } from '@/src/reading-progress';
import { createCardDraft } from '@/src/card-utils';
import { normalizedLookupEntry } from '@/src/discover';
import { downloadedBooks, readDownloadedBook } from '@/src/offline-books';
import { colors, fonts, shadows } from '@/src/theme';
import { isUuid } from '@/src/uuid';

type ReaderTheme = 'paper' | 'night';
const settingsKey = 'almonium:reader-settings';

const baseProgressScript = `
  (function () {
    let last = -1;
    function report() {
      const root = document.documentElement;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const percentage = Math.max(0, Math.min(100, Math.round((window.scrollY / max) * 100)));
      if (Math.abs(percentage - last) >= 1) {
        last = percentage;
        window.ReactNativeWebView.postMessage(String(percentage));
      }
    }
    document.addEventListener('scroll', report, { passive: true });
    window.addEventListener('load', report);
  })();
`;

const selectionScript = `
  (function () {
    function reportSelection() {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      if (!text || text.length > 80) return;
      let node = selection.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const paragraph = node && node.closest ? node.closest('p') : null;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'selection',
        text: text,
        context: paragraph ? paragraph.innerText.trim().slice(0, 500) : text
      }));
    }
    document.addEventListener('selectionchange', function () {
      clearTimeout(window.__almoniumSelectionTimer);
      window.__almoniumSelectionTimer = setTimeout(reportSelection, 280);
    });
  })();
`;

function appearanceScript(fontSize: number, theme: ReaderTheme, progress: number) {
  const background = theme === 'night' ? '#241f25' : colors.canvas;
  const foreground = theme === 'night' ? '#f1ecef' : colors.ink;
  return `
    (function () {
      let style = document.getElementById('almonium-reader-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'almonium-reader-style';
        document.head.appendChild(style);
      }
      style.textContent = \`
        html, body { background: ${background} !important; color: ${foreground} !important; }
        body {
          margin: 0 auto !important;
          padding: 28px 24px 110px !important;
          max-width: 720px !important;
          font-family: Georgia, "Times New Roman", serif !important;
          font-size: ${fontSize}px !important;
          line-height: 1.72 !important;
        }
        p { margin: 0 0 1.15em !important; }
        img { max-width: 100% !important; height: auto !important; }
        a { color: ${colors.raspberry} !important; }
      \`;
      document.documentElement.style.background = '${background}';
      setTimeout(function () {
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(0, max * ${Math.max(0, Math.min(100, progress)) / 100});
      }, 250);
      true;
    })();
  `;
}

function readerHtml(content: string) {
  if (/<html[\s>]/i.test(content)) return content;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /></head><body>${content}</body></html>`;
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ bookId: string; language?: string; title?: string }>();
  const bookId = params.bookId;
  const validBookId = isUuid(bookId);
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const webView = useRef<WebView>(null);
  const sync = useMemo(
    () =>
      validBookId && firebaseUser
        ? new ReadingProgressSync(bookId, firebaseUser.uid)
        : null,
    [bookId, validBookId, firebaseUser],
  );
  const [progress, setProgress] = useState<number | null>(null);
  const progressRef = useRef(0);
  const [fontSize, setFontSize] = useState(20);
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [parallel, setParallel] = useState(false);
  const [selection, setSelection] = useState<{ entry: string; context: string } | null>(null);
  const [savingWord, setSavingWord] = useState(false);
  const [wordSaved, setWordSaved] = useState(false);
  const [wordSaveError, setWordSaveError] = useState('');
  const [produceSelected, setProduceSelected] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textQuery = useQuery({
    queryKey: ['book-text', firebaseUser?.uid, bookId],
    queryFn: async () => (await readDownloadedBook(bookId)) ?? api.bookText(bookId),
    enabled: validBookId && Boolean(firebaseUser),
    staleTime: 10 * 60_000,
  });
  const infoQuery = useQuery({
    queryKey: ['book-info', firebaseUser?.uid, bookId],
    queryFn: async () => {
      try {
        return await api.bookInfo(bookId);
      } catch (error) {
        const downloaded = (await downloadedBooks()).find((book) => book.id === bookId);
        if (!downloaded) throw error;
        return {
          progressPercentage: downloaded.progressPercentage ?? 0,
          language: downloaded.language,
          languageVariants: [{ id: downloaded.id, language: downloaded.language }],
        };
      }
    },
    enabled: validBookId && Boolean(firebaseUser),
  });
  const parallelLanguage = infoQuery.data?.languageVariants.find(
    (variant) =>
      variant.language !== infoQuery.data.language &&
      profile?.fluentLangs.includes(variant.language),
  )?.language;
  const parallelQuery = useQuery({
    queryKey: ['book-parallel', firebaseUser?.uid, bookId, parallelLanguage],
    queryFn: () => api.parallelText(bookId, parallelLanguage!),
    enabled: parallel && Boolean(parallelLanguage),
    staleTime: 10 * 60_000,
  });
  const sourceLanguage = infoQuery.data?.language ?? '';
  const translationLanguage =
    profile?.fluentLangs.find((language) => language !== sourceLanguage) ??
    (sourceLanguage === 'EN' ? 'UK' : 'EN');
  const selectionQuery = useQuery({
    queryKey: ['discover', selection?.entry, sourceLanguage, translationLanguage, selection?.context],
    queryFn: () =>
      api.discover(selection!.entry, sourceLanguage, translationLanguage, selection!.context),
    enabled: Boolean(selection && sourceLanguage),
  });

  useEffect(() => {
    void AsyncStorage.getItem(settingsKey).then((value) => {
      if (!value) return;
      try {
        const settings = JSON.parse(value) as { fontSize?: number; theme?: ReaderTheme };
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.theme) setTheme(settings.theme);
      } catch {
        // Ignore stale settings from an incompatible app version.
      }
    });
  }, []);

  useEffect(() => {
    if (!sync || !infoQuery.data) return;
    void sync.restorePending().then((pending) => {
      const restored = pending ?? infoQuery.data.progressPercentage ?? 0;
      progressRef.current = restored;
      setProgress(restored);
      if (pending !== null) void sync.flush().catch(() => undefined);
    });
  }, [sync, infoQuery.data]);

  const flush = useCallback(async () => {
    if (!sync) return;
    try {
      await sync.flush();
      await queryClient.invalidateQueries({ queryKey: ['bookshelf', firebaseUser?.uid] });
    } catch {
      // Pending progress remains in AsyncStorage and is retried next time.
    }
  }, [sync, queryClient, firebaseUser?.uid]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush();
    });
    return () => {
      subscription.remove();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    void AsyncStorage.setItem(settingsKey, JSON.stringify({ fontSize, theme }));
    webView.current?.injectJavaScript(appearanceScript(fontSize, theme, progressRef.current));
  }, [fontSize, theme]);

  function onProgress(event: WebViewMessageEvent) {
    const message = event.nativeEvent.data;
    if (message.startsWith('{')) {
      try {
        const payload = JSON.parse(message) as { type?: string; text?: string; context?: string };
        if (payload.type === 'selection' && payload.text) {
          const entry = normalizedLookupEntry(payload.text);
          if (entry) {
            setWordSaved(false);
            setWordSaveError('');
            setProduceSelected(false);
            setSelection({ entry, context: payload.context || entry });
          }
        }
      } catch {
        // Ignore messages from malformed book scripts.
      }
      return;
    }
    const percentage = Number(message);
    if (!sync || !Number.isFinite(percentage)) return;
    const next = Math.max(0, Math.min(100, Math.round(percentage)));
    progressRef.current = next;
    setProgress(next);
    void sync.record(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 1500);
  }

  async function keepSelectedWord() {
    const lookup = selectionQuery.data;
    const sense = lookup?.senses[0];
    if (!lookup || !sense?.translations.length || savingWord) return;
    const draft = createCardDraft(
      sense.headword || lookup.entry,
      lookup.language,
      sense.translations.join('\n'),
      '',
      '',
    );
    if (lookup.sourceContext) draft.examples = [{ example: lookup.sourceContext }];
    draft.partOfSpeech = sense.partOfSpeech || undefined;
    draft.selectedSense = `${sense.index}: ${sense.translations.join(', ')}`;
    draft.sourceContext = lookup.sourceContext || undefined;
    draft.learningIntents = produceSelected ? ['UNDERSTAND', 'PRODUCE'] : ['UNDERSTAND'];
    setSavingWord(true);
    setWordSaveError('');
    try {
      await api.createCard(draft);
      await queryClient.invalidateQueries({ queryKey: ['cards', firebaseUser?.uid] });
      setWordSaved(true);
    } catch (error) {
      setWordSaveError(error instanceof Error ? error.message : 'The word could not be kept.');
    } finally {
      setSavingWord(false);
    }
  }

  if (!validBookId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>This reader link is invalid.</Text>
        <Button onPress={() => router.back()}>Back to library</Button>
      </View>
    );
  }

  const loading = textQuery.isLoading || infoQuery.isLoading || (parallel && parallelQuery.isLoading);
  const error = textQuery.error || infoQuery.error || (parallel ? parallelQuery.error : null);
  const content = parallel ? parallelQuery.data : textQuery.data;

  return (
    <View style={[styles.container, theme === 'night' && styles.containerNight]}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.status}>Opening at your last page…</Text>
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>This page would not open.</Text>
          <Text style={styles.status}>{error instanceof Error ? error.message : 'Please try again.'}</Text>
          <Button
            onPress={() => {
              void textQuery.refetch();
              void infoQuery.refetch();
              if (parallel) void parallelQuery.refetch();
            }}>
            Try again
          </Button>
        </View>
      )}
      {content && infoQuery.data && progress !== null && !loading && !error && (
        <>
          <SafeAreaView edges={['top']} style={[styles.readerHeader, theme === 'night' && styles.toolbarNight]}>
            <View style={styles.readerHeaderRow}>
              <Pressable accessibilityLabel="Back to book" onPress={() => router.back()} style={styles.toolButton}>
                <Ionicons name="chevron-back" size={24} color={theme === 'night' ? colors.white : colors.primary} />
              </Pressable>
              <View style={styles.readerTitleCopy}>
                <Text numberOfLines={1} style={[styles.readerTitle, theme === 'night' && styles.nightText]}>
                  {params.title || 'Reader'}
                </Text>
                <Text style={styles.readerMeta}>{sourceLanguage} → {translationLanguage}</Text>
              </View>
              <Pressable
                accessibilityLabel="Change text size"
                onPress={() => setFontSize((size) => size >= 24 ? 18 : size + 2)}
                style={styles.toolButton}>
                <Text style={[styles.largeA, theme === 'night' && styles.nightText]}>Aa</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={parallelLanguage ? 'Toggle parallel translation' : 'Toggle reader theme'}
                onPress={() => parallelLanguage ? setParallel((value) => !value) : setTheme((value) => value === 'paper' ? 'night' : 'paper')}
                style={styles.toolButton}>
                <Ionicons
                  name={parallelLanguage ? 'git-compare-outline' : theme === 'paper' ? 'moon-outline' : 'sunny-outline'}
                  size={20}
                  color={theme === 'night' ? colors.white : colors.muted}
                />
              </Pressable>
            </View>
            <View style={styles.headerTrack}><View style={[styles.headerBar, { width: `${progress}%` }]} /></View>
          </SafeAreaView>
          <WebView
            key={parallel ? `parallel-${parallelLanguage}` : 'single'}
            ref={webView}
            source={{ html: readerHtml(content) }}
            injectedJavaScript={`${appearanceScript(fontSize, theme, progress)}${baseProgressScript}${selectionScript}true;`}
            onMessage={onProgress}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith('about:blank')) return true;
              if (/^https?:|^mailto:/i.test(request.url)) void Linking.openURL(request.url);
              return false;
            }}
            originWhitelist={['about:*']}
            style={styles.webview}
          />
        </>
      )}
      <Modal transparent animationType="slide" visible={Boolean(selection)} onRequestClose={() => setSelection(null)}>
        <Pressable style={styles.scrim} onPress={() => setSelection(null)} />
        <SafeAreaView edges={['bottom']} style={styles.wordSheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.wordSheetContent}>
            {selectionQuery.isLoading ? (
              <View style={styles.sheetLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.status}>Opening the entry…</Text></View>
            ) : selectionQuery.isError ? (
              <View style={styles.sheetLoading}>
                <Text style={styles.errorTitle}>This word sheet would not open.</Text>
                <Button onPress={() => selectionQuery.refetch()}>Try again</Button>
              </View>
            ) : selectionQuery.data ? (
              <>
                <View style={styles.sheetHeading}>
                  <View style={styles.sheetHeadingCopy}>
                    <Text style={styles.sheetEntry}>{selectionQuery.data.senses[0]?.headword || selectionQuery.data.entry}</Text>
                    <Text style={styles.sheetMeta}>
                      {selectionQuery.data.senses[0]?.partOfSpeech || 'word'}
                      {selectionQuery.data.senses[0]?.transcription ? ` · /${selectionQuery.data.senses[0].transcription}/` : ''}
                      {selectionQuery.data.frequency ? ` · ${selectionQuery.data.frequency.band}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Learn about premium audio"
                    onPress={() => {
                      setSelection(null);
                      router.push('/membership');
                    }}
                    style={styles.sheetAudio}>
                    <Ionicons name="volume-medium-outline" size={21} color={colors.primary} />
                  </Pressable>
                </View>
                <View style={styles.definition}>
                  <Text style={styles.senseIndex}>{selectionQuery.data.senses[0]?.index ?? 1}</Text>
                  <View style={styles.definitionCopy}>
                    <Text style={styles.definitionText}>{selectionQuery.data.senses[0]?.translations.join(', ') || 'Meaning not supplied'}</Text>
                    {!!selectionQuery.data.sourceContext && <Text style={styles.sourceContext}>“{selectionQuery.data.sourceContext}”</Text>}
                  </View>
                </View>
                <View style={styles.sheetIntents}>
                  <View style={styles.sheetIntentActive}><Text style={styles.sheetIntentActiveText}>Understand it</Text></View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: produceSelected, disabled: wordSaved }}
                    disabled={wordSaved}
                    onPress={() => setProduceSelected((value) => !value)}
                    style={[produceSelected ? styles.sheetIntentActive : styles.sheetIntent, wordSaved && styles.sheetIntentDisabled]}>
                    <Text style={produceSelected ? styles.sheetIntentActiveText : styles.sheetIntentText}>Say it too</Text>
                  </Pressable>
                </View>
                <Button disabled={savingWord || wordSaved || !selectionQuery.data.senses[0]?.translations.length} onPress={keepSelectedWord}>
                  {wordSaved ? 'Kept' : savingWord ? 'Keeping…' : 'Keep this word'}
                </Button>
                {!!wordSaveError && <Text style={styles.sheetError}>{wordSaveError}</Text>}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  containerNight: { backgroundColor: '#241f25' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: colors.canvas },
  status: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  errorTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  readerHeader: { backgroundColor: colors.canvas },
  readerHeaderRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  readerTitleCopy: { flex: 1, alignItems: 'center', gap: 1 },
  readerTitle: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  readerMeta: { color: colors.metadata, fontSize: 10.5 },
  headerTrack: { height: 3, backgroundColor: colors.line },
  headerBar: { height: 3, backgroundColor: colors.primary },
  toolbarNight: { backgroundColor: '#302a31', borderTopColor: '#4c414b' },
  toolButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  largeA: { color: colors.ink, fontFamily: fonts.serif, fontSize: 16 },
  nightText: { color: colors.white },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(44,37,48,0.72)' },
  wordSheet: { position: 'absolute', right: 0, bottom: 0, left: 0, maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.canvas, ...shadows.media },
  grabber: { width: 38, height: 4, alignSelf: 'center', marginTop: 10, borderRadius: 2, backgroundColor: colors.border },
  wordSheetContent: { gap: 16, padding: 20, paddingTop: 14 },
  sheetLoading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetHeadingCopy: { flex: 1, gap: 4 },
  sheetEntry: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 37 },
  sheetMeta: { color: colors.metadata, fontSize: 12 },
  sheetAudio: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22 },
  definition: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  senseIndex: { color: colors.primary, fontSize: 12, paddingTop: 2 },
  definitionCopy: { flex: 1, gap: 7 },
  definitionText: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22 },
  sourceContext: { color: colors.muted, fontFamily: fonts.serifRegular, fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
  sheetIntents: { flexDirection: 'row', gap: 8 },
  sheetIntentActive: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 22, backgroundColor: colors.accentSoft },
  sheetIntent: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface },
  sheetIntentActiveText: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 14 },
  sheetIntentText: { color: colors.muted, fontSize: 14 },
  sheetIntentDisabled: { opacity: 0.55 },
  sheetError: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});

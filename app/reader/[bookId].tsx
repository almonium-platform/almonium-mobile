import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { BrandMark } from '@/components/brand-mark';
import { PaywallModal, type PaywallContext } from '@/components/paywall-modal';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { ReadingProgressSync } from '@/src/reading-progress';
import { createCardDraft } from '@/src/card-utils';
import { normalizedLookupEntry } from '@/src/discover';
import { lightImpact, successHaptic } from '@/src/haptics';
import { languageName } from '@/src/languages';
import { freeSavedItemLimit } from '@/src/limits';
import { downloadedBooks, readDownloadedBook } from '@/src/offline-books';
import { faceStacks, readerFaceCss } from '@/src/reader-fonts';
import {
  defaultReaderSettings,
  loadReaderSettings,
  parallelModes,
  readerFaces,
  saveReaderSettings,
  type ReaderSettings,
} from '@/src/reader-settings';
import { colors as lightColors, createThemedStyles, darkColors, fonts, shadows, useTheme } from '@/src/theme';
import type { Bookshelf } from '@/src/types';
import { useLearningActivity } from '@/src/use-activity';
import { isUuid } from '@/src/uuid';

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

/**
 * The aligned text arrives as seg-pairs holding one span per language. On demand hides the
 * fluent span until its sentence is tapped; inline gathers a block's fluent spans into a
 * paragraph of their own underneath, one size down. Side by side never runs on a phone.
 */
function parallelScript(fluent: string, mode: ReaderSettings['parallel']) {
  if (mode === 'off') return '';
  return `
    (function () {
      var fluent = '${fluent.toUpperCase()}';
      function isFluent(seg) { return (seg.getAttribute('lang') || '').toUpperCase().indexOf(fluent) === 0; }
      document.querySelectorAll('span.seg-pair').forEach(function (pair) {
        pair.querySelectorAll('span.segment').forEach(function (seg) {
          seg.classList.add(isFluent(seg) ? 'almonium-fluent' : 'almonium-target');
        });
      });
      ${
        mode === 'inline'
          ? `document.querySelectorAll('p, h2, div.poem').forEach(function (block) {
              var fluentSegments = block.querySelectorAll('.almonium-fluent');
              if (!fluentSegments.length) return;
              var translation = document.createElement('p');
              translation.className = 'almonium-inline';
              fluentSegments.forEach(function (seg) { translation.appendChild(seg); translation.appendChild(document.createTextNode(' ')); });
              block.parentNode.insertBefore(translation, block.nextSibling);
            });`
          : `document.addEventListener('click', function (event) {
              var selection = window.getSelection();
              if (selection && selection.toString().trim()) return;
              var pair = event.target && event.target.closest ? event.target.closest('span.seg-pair') : null;
              if (pair) pair.classList.toggle('almonium-open');
            });`
      }
    })();
  `;
}

function appearanceScript(settings: ReaderSettings, fontCss: string, progress: number) {
  const night = settings.theme === 'night';
  const background = night ? darkColors.canvas : lightColors.canvas;
  const foreground = night ? darkColors.ink : lightColors.ink;
  const muted = night ? darkColors.muted : lightColors.muted;
  const line = night ? darkColors.border : lightColors.border;
  return `
    (function () {
      let style = document.getElementById('almonium-reader-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'almonium-reader-style';
        document.head.appendChild(style);
      }
      style.textContent = \`
        ${fontCss}
        html, body { background: ${background} !important; color: ${foreground} !important; }
        body {
          margin: 0 auto !important;
          padding: 28px 22px 120px !important;
          max-width: 720px !important;
          font-family: ${faceStacks[settings.face]} !important;
          font-size: ${settings.fontSize}px !important;
          line-height: 1.65 !important;
        }
        p { margin: 0 0 1.1em !important; }
        img { max-width: 100% !important; height: auto !important; }
        a { color: ${lightColors.raspberry} !important; }
        .almonium-fluent { display: none; }
        .almonium-open .almonium-fluent { display: block; color: ${muted}; font-size: 0.92em; margin: 0.3em 0 0.6em; padding-left: 0.9em; border-left: 2px solid ${line}; }
        p.almonium-inline { color: ${muted}; font-size: 0.9em; margin-top: -0.55em !important; }
        p.almonium-inline .almonium-fluent { display: inline; }
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

const finishedKey = (bookId: string) => `almonium:finished:${bookId}`;

export default function ReaderScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ bookId: string; language?: string; title?: string; parallel?: string }>();
  const bookId = params.bookId;
  const validBookId = isUuid(bookId);
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const webView = useRef<WebView>(null);
  const sync = useMemo(
    () => (validBookId && firebaseUser ? new ReadingProgressSync(bookId, firebaseUser.uid) : null),
    [bookId, validBookId, firebaseUser],
  );
  const [progress, setProgress] = useState<number | null>(null);
  const progressRef = useRef(0);
  const [settings, setSettings] = useState<ReaderSettings>(defaultReaderSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [fontCss, setFontCss] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [paywallContext, setPaywallContext] = useState<PaywallContext | null>(null);
  const [selection, setSelection] = useState<{ entry: string; context: string } | null>(null);
  const [senseIndex, setSenseIndex] = useState(0);
  const [savingWord, setSavingWord] = useState(false);
  const [wordSaved, setWordSaved] = useState(false);
  const [wordSaveError, setWordSaveError] = useState('');
  const [produceSelected, setProduceSelected] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishedShown = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const night = settings.theme === 'night';

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
  const sourceLanguage = infoQuery.data?.language ?? '';
  const parallelLanguage =
    (params.parallel && infoQuery.data?.languageVariants.some((variant) => variant.language === params.parallel)
      ? params.parallel
      : undefined) ??
    infoQuery.data?.languageVariants.find(
      (variant) => variant.language !== sourceLanguage && profile?.fluentLangs.includes(variant.language),
    )?.language;
  const parallelActive = settings.parallel !== 'off' && Boolean(parallelLanguage);
  const parallelQuery = useQuery({
    queryKey: ['book-parallel', firebaseUser?.uid, bookId, parallelLanguage],
    queryFn: () => api.parallelText(bookId, parallelLanguage!),
    enabled: parallelActive,
    staleTime: 10 * 60_000,
  });
  const translationLanguage =
    profile?.fluentLangs.find((language) => language !== sourceLanguage) ??
    (sourceLanguage === 'EN' ? 'UK' : 'EN');
  const selectionQuery = useQuery({
    queryKey: ['discover', selection?.entry, sourceLanguage, translationLanguage, selection?.context],
    queryFn: () => api.discover(selection!.entry, sourceLanguage, translationLanguage, selection!.context),
    enabled: Boolean(selection && sourceLanguage),
  });
  const itemsQuery = useQuery({
    queryKey: ['cards', firebaseUser?.uid, sourceLanguage],
    queryFn: () => api.cards(sourceLanguage),
    enabled: Boolean(firebaseUser && sourceLanguage),
  });
  const activity = useLearningActivity('READ', sourceLanguage || null);
  const shelfBook = useMemo(() => {
    const shelf = queryClient.getQueryData<Bookshelf>(['bookshelf', firebaseUser?.uid, sourceLanguage]);
    return [...(shelf?.continueReading ?? []), ...(shelf?.available ?? []), ...(shelf?.favorites ?? [])].find(
      (book) => book.id === bookId,
    );
  }, [bookId, firebaseUser?.uid, queryClient, sourceLanguage]);

  useEffect(() => {
    void loadReaderSettings().then((loaded) => {
      setSettings(loaded);
      setSettingsLoaded(true);
    });
    void AsyncStorage.getItem(finishedKey(bookId)).then((value) => {
      finishedShown.current = value === 'true';
    });
  }, [bookId]);

  useEffect(() => {
    let active = true;
    void readerFaceCss(settings.face).then((css) => {
      if (active) setFontCss(css);
    });
    return () => {
      active = false;
    };
  }, [settings.face]);

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
    if (!settingsLoaded) return;
    void saveReaderSettings(settings);
  }, [settings, settingsLoaded]);

  useEffect(() => {
    webView.current?.injectJavaScript(appearanceScript(settings, fontCss, progressRef.current));
  }, [fontCss, settings]);

  function update(patch: Partial<ReaderSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  async function markFinished() {
    if (finishedShown.current) return;
    finishedShown.current = true;
    await AsyncStorage.setItem(finishedKey(bookId), 'true').catch(() => undefined);
    successHaptic();
    setFinished(true);
    void activity.complete();
  }

  function onMessage(event: WebViewMessageEvent) {
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
            setSenseIndex(0);
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
    activity.tick();
    const next = Math.max(0, Math.min(100, Math.round(percentage)));
    progressRef.current = next;
    setProgress(next);
    void sync.record(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 1500);
    if (next >= 99) void markFinished();
  }

  async function keepSelectedWord() {
    const lookup = selectionQuery.data;
    const sense = lookup?.senses[senseIndex] ?? lookup?.senses[0];
    if (!lookup || !sense?.translations.length || savingWord) return;
    if (!profile?.premium && (itemsQuery.data?.length ?? 0) >= freeSavedItemLimit) {
      setSelection(null);
      setPaywallContext('item-cap');
      return;
    }
    const draft = createCardDraft(sense.headword || lookup.entry, lookup.language, sense.translations.join('\n'), '', '');
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
      lightImpact();
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

  const loading = !settingsLoaded || textQuery.isLoading || infoQuery.isLoading || (parallelActive && parallelQuery.isLoading);
  const error = textQuery.error || infoQuery.error || (parallelActive ? parallelQuery.error : null);
  const content = parallelActive ? parallelQuery.data : textQuery.data;
  const savedInLanguage = itemsQuery.data?.length ?? 0;
  const lookup = selectionQuery.data;
  const selectedSense = lookup?.senses[senseIndex] ?? lookup?.senses[0];

  return (
    <View style={[styles.container, night && styles.containerNight]}>
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
              if (parallelActive) void parallelQuery.refetch();
            }}>
            Try again
          </Button>
          {parallelActive && <Button variant="secondary" onPress={() => update({ parallel: 'off' })}>Read the original only</Button>}
        </View>
      )}
      {content && infoQuery.data && progress !== null && !loading && !error && (
        <>
          <SafeAreaView edges={['top']} style={[styles.readerHeader, night && styles.toolbarNight]}>
            <View style={styles.readerHeaderRow}>
              <Pressable accessibilityLabel="Back to book" onPress={() => router.back()} style={styles.toolButton}>
                <Ionicons name="chevron-back" size={24} color={night ? colors.white : colors.primary} />
              </Pressable>
              <View style={styles.readerTitleCopy}>
                <Text numberOfLines={1} style={[styles.readerTitle, night && styles.nightText]}>
                  {params.title || shelfBook?.title || 'Reader'}
                </Text>
                <Text style={styles.readerMeta}>
                  {sourceLanguage}
                  {parallelActive && parallelLanguage ? ` → ${parallelLanguage}` : ''}
                </Text>
              </View>
              <Pressable accessibilityLabel="Open reader settings" onPress={() => setSettingsVisible(true)} style={styles.toolButton}>
                <Text style={[styles.largeA, night && styles.nightText]}>Aa</Text>
              </Pressable>
            </View>
            <View style={styles.headerTrack}><View style={[styles.headerBar, { width: `${progress}%` }]} /></View>
          </SafeAreaView>
          <WebView
            key={parallelActive ? `${settings.parallel}-${parallelLanguage}` : 'single'}
            ref={webView}
            source={{ html: readerHtml(content) }}
            injectedJavaScript={`${appearanceScript(settings, fontCss, progress)}${parallelActive && parallelLanguage ? parallelScript(parallelLanguage, settings.parallel) : ''}${baseProgressScript}${selectionScript}true;`}
            onMessage={onMessage}
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

      {/* The word sheet: Discover's plate, with the reader dimmed behind it and never dismissed. */}
      <Sheet visible={Boolean(selection)} onClose={() => setSelection(null)}>
        {selectionQuery.isLoading ? (
          <View style={styles.sheetLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.status}>Opening the entry…</Text></View>
        ) : selectionQuery.isError ? (
          <View style={styles.sheetLoading}>
            <Text style={styles.errorTitle}>This word sheet would not open.</Text>
            <Button onPress={() => selectionQuery.refetch()}>Try again</Button>
          </View>
        ) : lookup ? (
          <>
            <View style={styles.sheetHeading}>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetEntry}>{selectedSense?.headword || lookup.entry}</Text>
                <Text style={styles.sheetMeta}>
                  {selectedSense?.partOfSpeech || 'word'}
                  {selectedSense?.transcription ? ` · /${selectedSense.transcription}/` : ''}
                  {lookup.frequency ? ` · ${lookup.frequency.band}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Learn about narrated audio"
                onPress={() => {
                  setSelection(null);
                  setPaywallContext('audio');
                }}
                style={styles.sheetAudio}>
                <Ionicons name="volume-medium-outline" size={21} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.senses}>
              {lookup.senses.length ? (
                lookup.senses.map((sense, index) => {
                  const selected = index === senseIndex;
                  return (
                    <Pressable
                      key={`${sense.index}-${sense.headword}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={wordSaved}
                      onPress={() => setSenseIndex(index)}
                      style={[styles.sense, index > 0 && styles.senseDivider]}>
                      <Text style={[styles.senseIndex, !selected && styles.senseIndexMuted]}>{sense.index}</Text>
                      <View style={styles.definitionCopy}>
                        <Text style={[styles.definitionText, !selected && styles.definitionMuted]}>
                          {sense.translations.join(', ') || 'Meaning not supplied'}
                        </Text>
                        {selected && !!lookup.sourceContext && <Text style={styles.sourceContext}>„{lookup.sourceContext}“</Text>}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.status}>No structured dictionary sense is available yet.</Text>
              )}
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
            <Button disabled={savingWord || wordSaved || !selectedSense?.translations.length} onPress={() => void keepSelectedWord()}>
              {wordSaved ? 'Kept' : savingWord ? 'Keeping…' : 'Keep this word'}
            </Button>
            {!!wordSaveError && <Text style={styles.sheetError}>{wordSaveError}</Text>}
            {!profile?.premium && (
              <Text style={styles.capLine}>
                {savedInLanguage} of {freeSavedItemLimit} words kept. Free covers a hundred at a time —{' '}
                <Text onPress={() => { setSelection(null); setPaywallContext('item-cap'); }} style={styles.capLink}>see what changes</Text>.
              </Text>
            )}
          </>
        ) : null}
      </Sheet>

      {/* Reader type: three presets, size, translation mode, page. */}
      <Sheet visible={settingsVisible} onClose={() => setSettingsVisible(false)}>
        <View style={styles.settingsHeading}>
          <Text style={styles.settingsTitle}>Type</Text>
          <Pressable accessibilityLabel="Close reader settings" onPress={() => setSettingsVisible(false)} hitSlop={8}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.settingGroup}>
          {readerFaces.map((face) => {
            const selected = settings.face === face.value;
            return (
              <Pressable key={face.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => update({ face: face.value })} style={[styles.option, selected && styles.optionSelected]}>
                <View style={[styles.dot, selected && styles.dotSelected]} />
                <View style={styles.optionCopy}>
                  <Text style={[styles.sample, face.value === 'literata' ? styles.sampleSerif : styles.sampleSans]}>
                    The fact was Piglet was wishing he had thought of it first.
                  </Text>
                  <Text style={styles.optionNote}>{face.label}{face.note ? ` · ${face.note}` : ''}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.sizeRow}>
          <Text style={styles.sizeLabel}>Size</Text>
          <Pressable accessibilityLabel="Decrease text size" onPress={() => update({ fontSize: Math.max(16, settings.fontSize - 1) })} style={styles.sizeButton}>
            <Text style={styles.sizeSmall}>A</Text>
          </Pressable>
          <View style={styles.sizeTrack}>
            <View style={[styles.sizeFill, { width: `${((settings.fontSize - 16) / 12) * 100}%` }]} />
          </View>
          <Pressable accessibilityLabel="Increase text size" onPress={() => update({ fontSize: Math.min(28, settings.fontSize + 1) })} style={styles.sizeButton}>
            <Text style={styles.sizeLarge}>A</Text>
          </Pressable>
        </View>
        {!!parallelLanguage && (
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>{languageName(parallelLanguage).toUpperCase()} BESIDE THE TEXT</Text>
            {parallelModes.map((mode) => {
              const selected = settings.parallel === mode.value;
              return (
                <Pressable key={mode.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => update({ parallel: mode.value })} style={[styles.option, selected && styles.optionSelected]}>
                  <View style={[styles.dot, selected && styles.dotSelected]} />
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionLabel}>{mode.label}</Text>
                    <Text style={styles.optionNote}>{mode.note}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.optionNote}>Read the original first. Use the translation to check, not to skip.</Text>
          </View>
        )}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>PAGE</Text>
          <View style={styles.optionRow}>
            <ReaderOption label="Paper" selected={!night} onPress={() => update({ theme: 'paper' })} />
            <ReaderOption label="Night" selected={night} onPress={() => update({ theme: 'night' })} />
          </View>
        </View>
      </Sheet>

      {/* Book finished: one of the two earned events on the phone. The words are the trophy. */}
      <Sheet visible={finished} onClose={() => setFinished(false)}>
        <View style={styles.certificate}>
          <View style={styles.certificateInner}>
            <BrandMark size={44} />
            <Text style={styles.certificateEyebrow}>READ TO THE END</Text>
            <Text style={styles.certificateTitle}>{params.title || shelfBook?.title || 'This book'}</Text>
            <Text style={styles.certificateMeta}>
              {shelfBook?.author ? `${shelfBook.author} · ` : ''}{languageName(sourceLanguage)} · read by @{profile?.username}
            </Text>
            <View style={styles.certificateRule} />
            <View style={styles.certificateNumbers}>
              {!!shelfBook?.wordCount && <Text style={styles.certificateNumber}><Text style={styles.certificateStrong}>{shelfBook.wordCount.toLocaleString()}</Text> words read</Text>}
              <Text style={styles.certificateNumber}><Text style={styles.certificateStrong}>{savedInLanguage}</Text> saved</Text>
              <Text style={styles.certificateNumber}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            </View>
          </View>
        </View>
        <Button onPress={() => { setFinished(false); router.replace('/(tabs)/books'); }}>Back to your shelf</Button>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void Share.share({
              message: `I read ${params.title || shelfBook?.title || 'a book'} to the end in ${languageName(sourceLanguage)} on Almonium.`,
            }).catch(() => undefined)
          }
          style={styles.shareAction}>
          <Text style={styles.capLink}>Share</Text>
        </Pressable>
      </Sheet>

      <PaywallModal context={paywallContext ?? 'general'} visible={Boolean(paywallContext)} onClose={() => setPaywallContext(null)} />
    </View>
  );
}

function ReaderOption({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.readerOption, selected && styles.readerOptionActive]}>
      <Text style={[styles.readerOptionText, selected && styles.readerOptionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  container: { flex: 1, backgroundColor: colors.canvas },
  containerNight: { backgroundColor: darkColors.canvas },
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
  toolbarNight: { backgroundColor: darkColors.surface },
  toolButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  largeA: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17 },
  nightText: { color: colors.white },
  sheetLoading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetHeadingCopy: { flex: 1, gap: 4 },
  sheetEntry: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 37 },
  sheetMeta: { color: colors.metadata, fontSize: 12 },
  sheetAudio: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22 },
  senses: { borderRadius: 20, paddingHorizontal: 16, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  sense: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  senseDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  senseIndex: { width: 16, color: colors.primary, fontSize: 12, paddingTop: 3 },
  senseIndexMuted: { color: colors.metadata },
  definitionCopy: { flex: 1, gap: 7 },
  definitionText: { color: colors.ink, fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22 },
  definitionMuted: { color: colors.muted, fontFamily: fonts.sans },
  sourceContext: { color: colors.muted, fontFamily: fonts.serifRegular, fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
  sheetIntents: { flexDirection: 'row', gap: 8 },
  sheetIntentActive: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 22, backgroundColor: colors.accentSoft },
  sheetIntent: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface },
  sheetIntentActiveText: { color: colors.primary, fontFamily: fonts.sansSemibold, fontSize: 14 },
  sheetIntentText: { color: colors.muted, fontSize: 14 },
  sheetIntentDisabled: { opacity: 0.55 },
  sheetError: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  capLine: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  capLink: { color: colors.primary, fontWeight: '600' },
  settingsHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  settingsTitle: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  done: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  settingGroup: { gap: 4 },
  settingLabel: { color: colors.metadata, fontSize: 10, fontWeight: '600', letterSpacing: 1.3, paddingBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  optionSelected: { backgroundColor: colors.accentSoft },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  dotSelected: { borderWidth: 6, borderColor: colors.primary },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: { color: colors.ink, fontSize: 15 },
  optionNote: { color: colors.metadata, fontSize: 11.5, lineHeight: 16 },
  sample: { color: colors.reader, fontSize: 16, lineHeight: 21 },
  sampleSerif: { fontFamily: fonts.serifRegular },
  sampleSans: { fontFamily: fonts.sans },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  sizeLabel: { width: 44, color: colors.muted, fontSize: 12 },
  sizeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sizeSmall: { color: colors.metadata, fontFamily: fonts.serif, fontSize: 13 },
  sizeLarge: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20 },
  sizeTrack: { flex: 1, height: 2, backgroundColor: colors.line },
  sizeFill: { height: 2, backgroundColor: colors.primary },
  optionRow: { flexDirection: 'row', gap: 7 },
  readerOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22 },
  readerOptionActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  readerOptionText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  readerOptionTextActive: { color: colors.primary },
  certificate: { padding: 10, backgroundColor: lightColors.canvas },
  certificateInner: { alignItems: 'center', gap: 10, padding: 22, borderWidth: 1, borderColor: '#612B5E' },
  certificateEyebrow: { color: '#872657', fontFamily: fonts.serifRegular, fontSize: 11, letterSpacing: 2.5 },
  certificateTitle: { color: lightColors.ink, fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, textAlign: 'center' },
  certificateMeta: { color: lightColors.muted, fontFamily: fonts.serifRegular, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  certificateRule: { width: 100, height: 1, backgroundColor: '#612B5E', opacity: 0.5, marginVertical: 4 },
  certificateNumbers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  certificateNumber: { color: lightColors.muted, fontFamily: fonts.serifRegular, fontSize: 13 },
  certificateStrong: { color: lightColors.ink, fontFamily: fonts.serif },
  shareAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));

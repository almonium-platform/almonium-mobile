import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Linking,
  Pressable,
  ScrollView,
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
import { colors as lightColors, createThemedStyles, darkColors, fonts, serifLineHeight, shadows, useTheme } from '@/src/theme';
import type { Bookshelf } from '@/src/types';
import { useLearningActivity } from '@/src/use-activity';
import { isUuid } from '@/src/uuid';
import { chooseCompanion, companionEditions, editionLabel, isOtherEditionTranslation } from '@/src/reader-editions';
import { parallelScript } from '@/src/reader-parallel';
import {
  chapterDiscoveryScript, chapterEndScript, chapterEnrichment, chapterHeaderScript, chapterJumpScript, chapterLevelRange,
  chapterNumber, displayChapterTitle, parseReaderChapters, positionScript, type ReaderChapter,
} from '@/src/reader-chapters';
import {
  excerptParts, isSavedWord, readerLookupLanguage, savedLemmas, vocabularyLookup, vocabularySequence, vocabularyState,
  wordsAvailable, type ChapterVocabulary, type ReaderLookupSelection,
} from '@/src/reader-vocabulary';

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

function appearanceScript(settings: ReaderSettings, fontCss: string, progress: number) {
  const night = settings.theme === 'night';
  const background = night ? darkColors.canvas : lightColors.canvas;
  const foreground = night ? darkColors.ink : lightColors.ink;
  const muted = night ? darkColors.muted : lightColors.muted;
  const metadata = night ? darkColors.metadata : lightColors.metadata;
  const line = night ? darkColors.border : lightColors.border;
  const surface = night ? darkColors.surface : lightColors.surface;
  const tint = night ? darkColors.accentSoft : lightColors.accentSoft;
  const accent = night ? darkColors.primary : lightColors.primary;
  const sans = faceStacks.plex;
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
        .almonium-aligned-active { outline: 1px solid ${muted}; border-radius: 3px; }
        .almonium-open .almonium-fluent { display: block; color: ${muted}; font-size: 0.92em; margin: 0.3em 0 0.6em; padding-left: 0.9em; border-left: 2px solid ${line}; }
        p.almonium-inline { color: ${muted}; font-size: 0.9em; margin-top: -0.55em !important; }
        p.almonium-inline .almonium-fluent { display: inline; }
        .almonium-chapter-head { margin: -0.3em 0 1.5em; }
        .almonium-chapter-meta { font-family: ui-monospace, Menlo, monospace; font-size: 12px; letter-spacing: 0.3px; color: ${metadata}; margin-bottom: 8px; }
        .almonium-chapter-desc { color: ${muted} !important; font-size: 0.88em !important; line-height: 1.5 !important; margin: 0 !important; }
        .almonium-chapter-end { margin: 2.4em 0 3em; padding-top: 1.4em; border-top: 1px solid ${line}; font-family: ${sans}; }
        .almonium-words-title { font-size: 15px; font-weight: 600; color: ${foreground}; }
        .almonium-words-note { font-size: 13px; line-height: 1.45; color: ${muted}; margin: 4px 0 8px; }
        .almonium-word { display: block; width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid ${line}; padding: 12px 0; margin: 0; color: ${foreground}; font: inherit; }
        .almonium-word-head { display: flex; align-items: baseline; gap: 10px; }
        .almonium-word-lemma { font-family: ${faceStacks.literata}; font-size: 18px; }
        .almonium-word-surface { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: ${metadata}; }
        .almonium-word-excerpt { font-size: 13.5px; line-height: 1.5; color: ${muted}; margin-top: 4px; }
        .almonium-word-excerpt mark { background: ${tint}; color: inherit; border-radius: 3px; padding: 0 2px; }
        .almonium-words-all { display: block; background: none; border: 0; padding: 12px 0; margin: 0; color: ${accent}; font: inherit; font-size: 14px; font-weight: 600; }
        .almonium-next { display: block; width: 100%; text-align: left; margin-top: 1.4em; padding: 16px 18px; border: 1px solid ${line}; border-radius: 20px; background: ${surface}; color: ${foreground}; font: inherit; }
        .almonium-next-meta { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: ${metadata}; }
        .almonium-next-title { font-family: ${faceStacks.literata}; font-size: 20px; margin-top: 4px; }
        .almonium-next-desc { font-size: 13.5px; line-height: 1.5; color: ${muted}; margin-top: 6px; }
      \`;
      document.documentElement.style.background = '${background}';
      setTimeout(function () {
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.__almoniumScrollReset = true;
        window.scrollTo(0, max * ${Math.max(0, Math.min(100, progress)) / 100});
      }, 250);
      true;
    })();
  `;
}

/** The chrome floats over the page, so the text starts under it and a chapter jump lands below it. */
function layoutScript(top: number, bottom: number) {
  const above = Math.max(0, Math.round(top));
  const below = Math.max(0, Math.round(bottom));
  return `
    (function () {
      let style = document.getElementById('almonium-reader-layout');
      if (!style) { style = document.createElement('style'); style.id = 'almonium-reader-layout'; }
      style.textContent = 'body { padding-top: ${above + 20}px !important; padding-bottom: ${below + 48}px !important; } .chapter-title, h1, h2 { scroll-margin-top: ${above + 12}px; }';
      document.head.appendChild(style);
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
  const { t } = useTranslation();
  const { colors, reduceMotion } = useTheme();
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
  const [contentsVisible, setContentsVisible] = useState(false);
  const [wordsVisible, setWordsVisible] = useState(false);
  // The Words sheet follows the chapter being read until its arrows move it; null means follow.
  const [wordsChapterIndex, setWordsChapterIndex] = useState<number | null>(null);
  const [revealedChapter, setRevealedChapter] = useState<number | null>(null);
  const [currentChapter, setCurrentChapter] = useState(-1);
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const [chaptersReady, setChaptersReady] = useState(false);
  const [topHeight, setTopHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const chromeShown = useRef(new Animated.Value(1)).current;
  const chromeState = useRef(true);
  const insets = useRef({ top: 0, bottom: 0 });
  const injectedEnds = useRef(new Set<number>());
  const contentsScroll = useRef<ScrollView>(null);
  // The contents list's offset inside the sheet, and whether this opening has already scrolled to the current chapter.
  const contentsListTop = useRef(0);
  const contentsScrolled = useRef(false);
  const [paywallContext, setPaywallContext] = useState<PaywallContext | null>(null);
  const [selection, setSelection] = useState<ReaderLookupSelection | null>(null);
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
  const variants = infoQuery.data?.languageVariants ?? [];
  const primaryEdition = variants.find(variant => variant.id === bookId);
  const primarySlug = primaryEdition?.editionSlug;
  // Chapters that can carry a list: processor anchors only. The arrows in the Words sheet walk these.
  const wordChapters = useMemo(() => chapters.filter(chapter => vocabularySequence(chapter)), [chapters]);
  const readingChapter = chapters[currentChapter] as ReaderChapter | undefined;
  const readingSequence = readingChapter ? vocabularySequence(readingChapter) : undefined;
  const wordsChapter = (wordsChapterIndex === null ? undefined : chapters[wordsChapterIndex])
    ?? (readingSequence ? readingChapter : wordChapters[0]);
  const wordsSequence = wordsChapter ? vocabularySequence(wordsChapter) : undefined;
  const vocabularyKey = (sequence: number | undefined) => ['book-chapter-vocabulary', firebaseUser?.uid, primarySlug, sequence];
  const vocabularyQuery = useQuery({
    queryKey: vocabularyKey(wordsSequence),
    queryFn: () => api.bookChapterVocabulary(primarySlug!, wordsSequence!),
    enabled: Boolean(wordsVisible && primarySlug && wordsSequence && firebaseUser),
    staleTime: 0,
    retry: false,
  });
  const wordListState = vocabularyState(vocabularyQuery.data, vocabularyQuery.isPaused,
    vocabularyQuery.isError, vocabularyQuery.isFetching);
  // The chapter being read: its words go to the chapter end, and its status decides whether Words shows at all.
  const readingVocabularyQuery = useQuery({
    queryKey: vocabularyKey(readingSequence),
    queryFn: () => api.bookChapterVocabulary(primarySlug!, readingSequence!),
    enabled: Boolean(chaptersReady && primarySlug && readingSequence && firebaseUser),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const chaptersQuery = useQuery({
    queryKey: ['book-chapters', firebaseUser?.uid, primarySlug],
    queryFn: () => api.bookChapters(primarySlug!),
    enabled: Boolean(primarySlug && firebaseUser),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const [includeOtherEditionTranslations, setIncludeOtherEditionTranslations] = useState(true);
  const allCompanions = companionEditions(variants, bookId);
  const hasOtherEditionTranslations = allCompanions.some(edition => isOtherEditionTranslation(edition, primaryEdition));
  const visibleVariants = variants.filter(edition => includeOtherEditionTranslations || !isOtherEditionTranslation(edition, primaryEdition));
  const companions = companionEditions(visibleVariants, bookId);
  const companion = chooseCompanion(visibleVariants, bookId, params.parallel, profile?.fluentLangs ?? []);
  const parallelLanguage = companion?.language;
  const parallelActive = settings.parallel !== 'off' && Boolean(companion?.editionSlug && primarySlug);
  const parallelQuery = useQuery({
    queryKey: ['book-parallel-edition', firebaseUser?.uid, primarySlug, companion?.editionSlug],
    queryFn: () => api.parallelEditionText(primarySlug!, companion!.editionSlug!),
    enabled: parallelActive && Boolean(firebaseUser),
    staleTime: 10 * 60_000,
  });
  const lookupLanguage = readerLookupLanguage(selection, sourceLanguage);
  const translationLanguage =
    profile?.fluentLangs.find((language) => language !== lookupLanguage) ??
    (lookupLanguage === 'EN' ? 'UK' : 'EN');
  const selectionQuery = useQuery({
    queryKey: ['discover', selection?.entry, lookupLanguage, translationLanguage, selection?.context],
    queryFn: () => api.discover(selection!.entry, lookupLanguage, translationLanguage, selection!.context),
    enabled: Boolean(selection && lookupLanguage),
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
    setWordsChapterIndex(null);
    setWordsVisible(false);
    setContentsVisible(false);
    setSelection(null);
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

  useEffect(() => {
    insets.current = { top: topHeight, bottom: bottomHeight };
    webView.current?.injectJavaScript(layoutScript(topHeight, bottomHeight));
  }, [topHeight, bottomHeight]);

  const showChrome = useCallback((shown: boolean) => {
    if (chromeState.current === shown) return;
    chromeState.current = shown;
    Animated.timing(chromeShown, { toValue: shown ? 1 : 0, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start();
  }, [chromeShown, reduceMotion]);

  const bookTitle = params.title || shelfBook?.title || t('This book');
  const enrichment = chaptersQuery.data;
  const chapterMeta = useCallback((chapter: ReaderChapter) => {
    const detail = chapterEnrichment(chapter, enrichment);
    const count = t('Chapter {number} of {total}', { number: chapterNumber(chapter), total: chapters.length });
    return detail?.cefrEstimate ? `${count} · ${t('Estimated')} ${detail.cefrEstimate}` : count;
  }, [chapters.length, enrichment, t]);

  // The chapter header: the mono line and the description under each heading that has them.
  useEffect(() => {
    if (!chaptersReady || !enrichment?.length) return;
    const headers = chapters.flatMap(chapter => {
      const detail = chapterEnrichment(chapter, enrichment);
      if (!detail) return [];
      return [{ index: chapter.index, meta: chapterMeta(chapter), description: detail.descriptions.join(' ') }];
    });
    if (headers.length) webView.current?.injectJavaScript(chapterHeaderScript(headers));
  }, [chapterMeta, chapters, chaptersReady, enrichment]);

  // The chapter end for the chapter being read, once its words have answered one way or the other.
  useEffect(() => {
    if (!chaptersReady || !readingChapter || readingVocabularyQuery.isFetching || chaptersQuery.isFetching || injectedEnds.current.has(readingChapter.index)) return;
    if (readingSequence && !readingVocabularyQuery.data && !readingVocabularyQuery.isError && !readingVocabularyQuery.isPaused) return;
    injectedEnds.current.add(readingChapter.index);
    const words = readingVocabularyQuery.data?.status === 'ready' ? readingVocabularyQuery.data.words : [];
    const following = chapters[readingChapter.index + 1];
    const nextDetail = following ? chapterEnrichment(following, enrichment) : undefined;
    webView.current?.injectJavaScript(chapterEndScript({
      index: readingChapter.index,
      title: t('Words from this chapter'),
      note: t('{count, plural, one {# of the book’s useful words occurs here.} other {# of the book’s useful words occur here.}} Each example is from the text.', { count: words.length }),
      words,
      shown: 3,
      allLabel: t('All {count} words', { count: words.length }),
      next: following ? {
        index: following.index,
        meta: nextDetail?.cefrEstimate ? `${t('Next')} · ${t('Estimated')} ${nextDetail.cefrEstimate}` : t('Next'),
        title: displayChapterTitle(following.title) || t('Untitled chapter'),
        description: nextDetail?.descriptions.join(' ') ?? '',
      } : null,
    }));
  }, [chapters, chaptersQuery.isFetching, chaptersReady, enrichment, readingChapter, readingSequence, readingVocabularyQuery.data,
    readingVocabularyQuery.isError, readingVocabularyQuery.isFetching, readingVocabularyQuery.isPaused, t]);

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
        const payload = JSON.parse(message) as {
          type?: string; text?: string; context?: string; chapters?: unknown; chapter?: unknown; chrome?: unknown; blockId?: unknown; lemma?: unknown;
        };
        if (payload.type === 'chapters') {
          setChapters(parseReaderChapters(payload.chapters));
          setChaptersReady(true);
          return;
        }
        if (payload.type === 'position') {
          if (Number.isInteger(payload.chapter)) setCurrentChapter(payload.chapter as number);
          if (typeof payload.chrome === 'boolean') showChrome(payload.chrome);
          return;
        }
        if (payload.type === 'chapter-word' && Number.isInteger(payload.chapter)) {
          // A row at the chapter end: open the word from the list already fetched for that chapter.
          const chapter = chapters[payload.chapter as number];
          const data = chapter && primarySlug ? queryClient.getQueryData<ChapterVocabulary>(vocabularyKey(vocabularySequence(chapter))) : undefined;
          const word = data?.words.find(row => row.blockId === payload.blockId && row.lemma === payload.lemma);
          if (!chapter || !data || !word) return;
          openWord(vocabularyLookup(word, data, primarySlug!, bookTitle, displayChapterTitle(chapter.title)));
          setWordsChapterIndex(chapter.index);
          setWordsVisible(true);
          return;
        }
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

  function openWord(next: ReaderLookupSelection) {
    setWordSaved(false);
    setWordSaveError('');
    setProduceSelected(false);
    setSenseIndex(0);
    setSelection(next);
  }

  function jumpTo(chapter: ReaderChapter) {
    webView.current?.injectJavaScript(chapterJumpScript(chapter.index));
    showChrome(true);
    setContentsVisible(false);
  }

  function openContents() {
    setRevealedChapter(null);
    contentsScrolled.current = false;
    setContentsVisible(true);
  }

  function openWords() {
    setWordsChapterIndex(null);
    setSelection(null);
    setWordsVisible(true);
  }

  function closeWords() {
    setWordsVisible(false);
    setSelection(null);
  }

  async function keepSelectedWord() {
    const lookup = selectionQuery.data;
    const sense = lookup?.senses[senseIndex] ?? lookup?.senses[0];
    if (!lookup || !sense?.translations.length || savingWord) return;
    if (!profile?.premium && (itemsQuery.data?.length ?? 0) >= freeSavedItemLimit) {
      closeWords();
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
      setWordSaveError(error instanceof Error ? error.message : t('The word could not be kept.'));
    } finally {
      setSavingWord(false);
    }
  }

  if (!validBookId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('This reader link is invalid.')}</Text>
        <Button onPress={() => router.back()}>{t('Back to library')}</Button>
      </View>
    );
  }

  const loading = !settingsLoaded || textQuery.isLoading || infoQuery.isLoading || (parallelActive && parallelQuery.isLoading);
  const error = textQuery.error || infoQuery.error || (parallelActive ? parallelQuery.error : null);
  const content = parallelActive ? parallelQuery.data : textQuery.data;
  const savedInLanguage = itemsQuery.data?.length ?? 0;
  const lookup = selectionQuery.data;
  const selectedSense = lookup?.senses[senseIndex] ?? lookup?.senses[0];
  const saved = savedLemmas(itemsQuery.data);
  const showWords = wordsAvailable(chapters, primarySlug, readingVocabularyQuery.data);
  const levelRange = chapterLevelRange(chapters, enrichment);
  const wordsPosition = wordsChapter ? wordChapters.findIndex(chapter => chapter.index === wordsChapter.index) : -1;
  const wordsDetail = wordsChapter ? chapterEnrichment(wordsChapter, enrichment) : undefined;
  // A word opened from a list keeps the list behind it; a word selected in the text stands alone.
  const wordFromList = Boolean(selection?.source);
  const topTravel = chromeShown.interpolate({ inputRange: [0, 1], outputRange: [-(topHeight || 120), 0] });
  const bottomTravel = chromeShown.interpolate({ inputRange: [0, 1], outputRange: [bottomHeight || 120, 0] });

  const wordCard = (
    <>
      {selectionQuery.isPaused ? <Text style={styles.status}>{t('Word lookup is unavailable offline. You can return to the book and keep reading.')}</Text> : selectionQuery.isLoading ? (
          <View style={styles.sheetLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.status}>{t('Opening the entry…')}</Text></View>
        ) : selectionQuery.isError ? (
          <View style={styles.sheetLoading}>
            <Text style={styles.errorTitle}>{t('This word sheet would not open.')}</Text>
            <Button onPress={() => selectionQuery.refetch()}>{t('Try again')}</Button>
          </View>
        ) : lookup ? (
          <>
            <View style={styles.sheetHeading}>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetEntry}>{selectedSense?.headword || lookup.entry}</Text>
                <Text style={styles.sheetMeta}>
                  {selectedSense?.partOfSpeech || t('word')}
                  {selectedSense?.transcription ? ` · /${selectedSense.transcription}/` : ''}
                  {lookup.frequency ? ` · ${lookup.frequency.band}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={t('Learn about narrated audio')}
                onPress={() => {
                  closeWords();
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
                          {sense.translations.join(', ') || t('Meaning not supplied')}
                        </Text>
                        {selected && !!lookup.sourceContext && <Text style={styles.sourceContext}>„{lookup.sourceContext}“</Text>}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.status}>{t('No structured dictionary sense is available yet.')}</Text>
              )}
            </View>
            <View style={styles.sheetIntents}>
              <View style={styles.sheetIntentActive}><Text style={styles.sheetIntentActiveText}>{t('Understand it')}</Text></View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: produceSelected, disabled: wordSaved }}
                disabled={wordSaved}
                onPress={() => setProduceSelected((value) => !value)}
                style={[produceSelected ? styles.sheetIntentActive : styles.sheetIntent, wordSaved && styles.sheetIntentDisabled]}>
                <Text style={produceSelected ? styles.sheetIntentActiveText : styles.sheetIntentText}>{t('Say it too')}</Text>
              </Pressable>
            </View>
            <Button disabled={savingWord || wordSaved || !selectedSense?.translations.length} onPress={() => void keepSelectedWord()}>
              {wordSaved ? t('Kept') : savingWord ? t('Keeping…') : t('Keep this word')}
            </Button>
            {!!wordSaveError && <Text style={styles.sheetError}>{wordSaveError}</Text>}
            {!profile?.premium && (
              <Text style={styles.capLine}>
                {t('{saved} of {limit} words kept. Free covers a hundred at a time.', { saved: savedInLanguage, limit: freeSavedItemLimit })}{' '}
                <Text onPress={() => { closeWords(); setPaywallContext('item-cap'); }} style={styles.capLink}>{t('See what changes.')}</Text>
              </Text>
            )}
          </>
        ) : null}
    </>
  );

  return (
    <View style={[styles.container, night && styles.containerNight]}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.status}>{t('Opening at your last page…')}</Text>
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('This page would not open.')}</Text>
          <Text style={styles.status}>{error instanceof Error ? error.message : t('Please try again.')}</Text>
          <Button
            onPress={() => {
              void textQuery.refetch();
              void infoQuery.refetch();
              if (parallelActive) void parallelQuery.refetch();
            }}>
            {t('Try again')}
          </Button>
          {parallelActive && <Button variant="secondary" onPress={() => update({ parallel: 'off' })}>{t('Read without the companion')}</Button>}
        </View>
      )}
      {content && infoQuery.data && progress !== null && !loading && !error && (
        <>
          <WebView
            key={parallelActive ? `${settings.parallel}-${companion?.editionSlug}` : 'single'}
            ref={webView}
            source={{ html: readerHtml(content) }}
            injectedJavaScript={`${appearanceScript(settings, fontCss, progress)}${layoutScript(insets.current.top, insets.current.bottom)}${parallelActive && parallelLanguage ? parallelScript(parallelLanguage, settings.parallel) : ''}${chapterDiscoveryScript}${positionScript}${baseProgressScript}${selectionScript}true;`}
            onLoadStart={() => { setChapters([]); setChaptersReady(false); setCurrentChapter(-1); injectedEnds.current.clear(); showChrome(true); }}
            onLoadEnd={() => webView.current?.injectJavaScript(layoutScript(insets.current.top, insets.current.bottom))}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith('about:blank')) return true;
              if (/^https?:|^mailto:/i.test(request.url)) void Linking.openURL(request.url);
              return false;
            }}
            originWhitelist={['about:*']}
            style={styles.webview}
          />
          {/* The chrome floats over the page and leaves on a scroll down; the text is the surface. */}
          <Animated.View
            onLayout={event => setTopHeight(event.nativeEvent.layout.height)}
            style={[styles.topChrome, { transform: [{ translateY: topTravel }] }]}>
            <SafeAreaView edges={['top']} style={[styles.readerHeader, night && styles.toolbarNight]}>
              <View style={styles.readerHeaderRow}>
                <Pressable accessibilityLabel={t('Back to book')} onPress={() => router.back()} style={styles.toolButton}>
                  <Ionicons name="chevron-back" size={24} color={night ? colors.white : colors.primary} />
                </Pressable>
                <View style={styles.readerTitleCopy}>
                  <Text numberOfLines={1} style={[styles.readerTitle, night && styles.nightText]}>
                    {params.title || shelfBook?.title || t('Reader')}
                  </Text>
                  <Text numberOfLines={1} style={styles.readerMeta}>
                    {readingChapter ? `${displayChapterTitle(readingChapter.title)} · ` : ''}
                    {sourceLanguage}
                    {parallelActive && companion ? ` ↔ ${editionLabel(companion, primaryEdition)}` : ''}
                  </Text>
                </View>
                <View style={styles.toolButton} />
              </View>
              <View style={styles.headerTrack}><View style={[styles.headerBar, { width: `${progress}%` }]} /></View>
            </SafeAreaView>
          </Animated.View>
          <Animated.View
            onLayout={event => setBottomHeight(event.nativeEvent.layout.height)}
            style={[styles.bottomChrome, { transform: [{ translateY: bottomTravel }] }]}>
            <SafeAreaView edges={['bottom']} style={[styles.readerBar, night && styles.toolbarNight]}>
              <ChromePill icon="list-outline" label={t('Contents')} active={contentsVisible} night={night} onPress={openContents} />
              {showWords && (
                <ChromePill icon="bookmarks-outline" label={t('Words')} active={wordsVisible} night={night} onPress={openWords} />
              )}
              <View style={styles.barSpacer} />
              <Pressable accessibilityLabel={t('Open reader settings')} onPress={() => setSettingsVisible(true)} style={styles.toolButton}>
                <Text style={[styles.largeA, night && styles.nightText]}>Aa</Text>
              </Pressable>
            </SafeAreaView>
          </Animated.View>
        </>
      )}

      {/* Contents: title and level per row; the description on the chapter being read, or on a row tapped once. */}
      <Sheet visible={contentsVisible} onClose={() => setContentsVisible(false)} scrollRef={contentsScroll}>
        <View style={styles.settingsHeading}>
          <View style={styles.sheetHeadingCopy}>
            <Text style={styles.sheetTitle}>{t('Contents')}</Text>
            {chaptersReady && chapters.length > 0 && (
              <Text style={styles.sheetSubtitle}>
                {t('{count, plural, one {# chapter} other {# chapters}}', { count: chapters.length })}
                {levelRange ? ` · ${levelRange}` : ''}
              </Text>
            )}
          </View>
          <Pressable accessibilityLabel={t('Close contents')} onPress={() => setContentsVisible(false)} hitSlop={8} style={styles.sheetClose}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
        {!chaptersReady && <Text style={styles.status}>{t('Loading chapter navigation…')}</Text>}
        {chaptersReady && chapters.length === 0 && <Text style={styles.status}>{t('This edition has no chapter headings. You can keep reading normally.')}</Text>}
        {chaptersQuery.isError && <Text style={styles.optionNote}>{t('Chapter estimates are unavailable. Navigation still works.')}</Text>}
        <View style={styles.contentsList} onLayout={event => { contentsListTop.current = event.nativeEvent.layout.y; }}>
          {chapters.map(chapter => {
            const detail = chapterEnrichment(chapter, enrichment);
            const description = detail?.descriptions.join(' ') ?? '';
            const current = chapter.index === currentChapter;
            const open = current || chapter.index === revealedChapter;
            return (
              <Pressable
                key={chapter.index}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityHint={description && !open ? t('Tap once for the description, twice to go') : undefined}
                onLayout={current && contentsVisible ? event => {
                  if (contentsScrolled.current) return;
                  contentsScrolled.current = true;
                  const y = contentsListTop.current + event.nativeEvent.layout.y;
                  contentsScroll.current?.scrollTo({ y: Math.max(0, y - 120), animated: false });
                } : undefined}
                onPress={() => {
                  if (description && !open) { setRevealedChapter(chapter.index); return; }
                  jumpTo(chapter);
                }}
                style={({ pressed }) => [styles.contentsRow, open && description ? styles.contentsRowOpen : null, current && styles.contentsRowCurrent, pressed && styles.optionSelected]}>
                <View style={styles.contentsRowHead}>
                  <Text style={[styles.contentsTitle, current && styles.contentsTitleCurrent]}>{displayChapterTitle(chapter.title) || t('Untitled chapter')}</Text>
                  {!!detail?.cefrEstimate && <Text style={styles.levelTag}>{detail.cefrEstimate}</Text>}
                </View>
                {open && !!description && <Text style={styles.contentsDescription}>{description}</Text>}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* Words: the chapter's list, which swaps to the word itself when a row is tapped. */}
      <Sheet visible={wordsVisible} onClose={closeWords}>
        {wordFromList && selection ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => setSelection(null)} style={styles.backRow} hitSlop={8}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.done}>{t('Words')}</Text>
            </Pressable>
            <Text style={styles.optionNote}>{selection.source!.bookTitle} · {selection.source!.chapterTitle} · {lookupLanguage}</Text>
            {wordCard}
          </>
        ) : (
          <>
            <View style={styles.settingsHeading}>
              <Text style={styles.settingsTitle}>{t('WORDS FROM THIS CHAPTER')}</Text>
              <Pressable accessibilityLabel={t('Close words')} onPress={closeWords} hitSlop={8} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
            {wordsChapter ? (
              <View style={styles.wordsHead}>
                <View style={styles.sheetHeadingCopy}>
                  <Text style={styles.wordsChapter}>{displayChapterTitle(wordsChapter.title) || t('Untitled chapter')}</Text>
                  <Text style={styles.sheetSubtitle}>
                    {wordListState === 'ready' ? t('{count, plural, one {# word} other {# words}}', { count: vocabularyQuery.data?.words.length ?? 0 }) : ''}
                    {wordListState === 'ready' && wordsDetail?.cefrEstimate ? ' · ' : ''}
                    {wordsDetail?.cefrEstimate ? `${t('Estimated')} ${wordsDetail.cefrEstimate}` : ''}
                  </Text>
                </View>
                <Pressable accessibilityLabel={t('Previous chapter’s words')} disabled={wordsPosition <= 0}
                  onPress={() => setWordsChapterIndex(wordChapters[wordsPosition - 1].index)}
                  style={[styles.arrowButton, wordsPosition <= 0 && styles.arrowDisabled]}>
                  <Ionicons name="chevron-back" size={20} color={colors.ink} />
                </Pressable>
                <Pressable accessibilityLabel={t('Next chapter’s words')} disabled={wordsPosition < 0 || wordsPosition >= wordChapters.length - 1}
                  onPress={() => setWordsChapterIndex(wordChapters[wordsPosition + 1].index)}
                  style={[styles.arrowButton, (wordsPosition < 0 || wordsPosition >= wordChapters.length - 1) && styles.arrowDisabled]}>
                  <Ionicons name="chevron-forward" size={20} color={colors.ink} />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.status}>{t('This edition has no chapter word lists yet.')}</Text>
            )}
            {wordListState === 'loading' && <ActivityIndicator accessibilityLabel={t('Loading vocabulary')} color={colors.primary} />}
            {wordListState === 'offline' && <Text style={styles.status}>{t('Words are unavailable offline. You can keep reading and try again when connected.')}</Text>}
            {wordListState === 'error' && <>
              <Text style={styles.status}>{t('Words could not be loaded. Reading still works.')}</Text>
              <Button variant="secondary" onPress={() => vocabularyQuery.refetch()}>{t('Try again')}</Button>
            </>}
            {wordsChapter && wordListState === 'unavailable' && <Text style={styles.status}>{t('Words for this chapter aren’t ready yet.')}</Text>}
            {wordListState === 'empty' && <Text style={styles.status}>{t('No selected useful words occur in this chapter.')}</Text>}
            {wordListState === 'ready' && (
              <View style={styles.wordsList}>
                {vocabularyQuery.data?.words.map(word => {
                  const [before, match, after] = excerptParts(word.context, word.surface);
                  const first = word === vocabularyQuery.data?.words[0];
                  return (
                    <Pressable
                      key={`${word.blockId}:${word.lemma}`}
                      accessibilityRole="button"
                      accessibilityLabel={word.lemma}
                      onPress={() => openWord(vocabularyLookup(word, vocabularyQuery.data!, primarySlug!, bookTitle, displayChapterTitle(wordsChapter!.title)))}
                      style={({ pressed }) => [styles.wordRow, first && styles.wordRowFirst, pressed && styles.optionSelected]}>
                      <View style={styles.wordHead}>
                        <Text style={styles.wordLemma}>{word.lemma}</Text>
                        {word.surface !== word.lemma && <Text style={styles.wordSurface}>{word.surface}</Text>}
                        <View style={styles.barSpacer} />
                        {isSavedWord(word, saved) && <Text style={styles.savedMark}>{t('Saved')}</Text>}
                      </View>
                      <Text style={styles.wordExcerpt}>
                        {before}{!!match && <Text style={styles.wordMatch}>{match}</Text>}{after}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </Sheet>

      {/* The word sheet: Discover's plate, with the reader dimmed behind it and never dismissed. */}
      <Sheet visible={Boolean(selection) && !wordFromList} onClose={() => setSelection(null)}>
        {wordCard}
      </Sheet>

      {/* Reader type: three presets, size, translation mode, page. */}
      <Sheet visible={settingsVisible} onClose={() => setSettingsVisible(false)}>
        <View style={styles.settingsHeading}>
          <Text style={styles.settingsTitle}>{t('Type')}</Text>
          <Pressable accessibilityLabel={t('Close reader settings')} onPress={() => setSettingsVisible(false)} hitSlop={8}>
            <Text style={styles.done}>{t('Done')}</Text>
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
                    {t('The fact was Piglet was wishing he had thought of it first.')}
                  </Text>
                  <Text style={styles.optionNote}>{face.label}{face.note ? ` · ${t(face.note)}` : ''}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.sizeRow}>
          <Text style={styles.sizeLabel}>{t('Size')}</Text>
          <Pressable accessibilityLabel={t('Decrease text size')} onPress={() => update({ fontSize: Math.max(16, settings.fontSize - 1) })} style={styles.sizeButton}>
            <Text style={styles.sizeSmall}>A</Text>
          </Pressable>
          <View style={styles.sizeTrack}>
            <View style={[styles.sizeFill, { width: `${((settings.fontSize - 16) / 12) * 100}%` }]} />
          </View>
          <Pressable accessibilityLabel={t('Increase text size')} onPress={() => update({ fontSize: Math.min(28, settings.fontSize + 1) })} style={styles.sizeButton}>
            <Text style={styles.sizeLarge}>A</Text>
          </Pressable>
        </View>
        {allCompanions.length > 0 && primarySlug && (
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>{t('COMPANION EDITION')}</Text>
            {hasOtherEditionTranslations && (
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: includeOtherEditionTranslations }}
                onPress={() => {
                  if (includeOtherEditionTranslations && companion && isOtherEditionTranslation(companion, primaryEdition)) {
                    update({ parallel: 'off' });
                  }
                  setIncludeOtherEditionTranslations(value => !value);
                }} style={styles.option}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{t('Include translations of other editions')}: {includeOtherEditionTranslations ? t('On') : t('Off')}</Text>
                  <Text style={styles.optionNote}>{t('These translations may use more literary wording than this adaptation.')}</Text>
                </View>
              </Pressable>
            )}
            {companions.map(edition => (
              <Pressable key={edition.id} accessibilityRole="radio" accessibilityState={{ selected: companion?.id === edition.id }}
                onPress={() => router.setParams({ parallel: edition.editionSlug })}
                style={[styles.option, companion?.id === edition.id && styles.optionSelected]}>
                <View style={[styles.dot, companion?.id === edition.id && styles.dotSelected]} />
                <Text style={styles.optionLabel}>{editionLabel(edition, primaryEdition)}</Text>
              </Pressable>
            ))}
            {parallelModes.map((mode) => {
              const selected = settings.parallel === mode.value;
              return (
                <Pressable key={mode.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => update({ parallel: mode.value })} style={[styles.option, selected && styles.optionSelected]}>
                  <View style={[styles.dot, selected && styles.dotSelected]} />
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionLabel}>{t(mode.label)}</Text>
                    <Text style={styles.optionNote}>{t(mode.note)}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.optionNote}>{t('Use the companion to check wording. Uncertain passages stay paragraph-aligned.')}</Text>
          </View>
        )}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>{t('PAGE')}</Text>
          <View style={styles.optionRow}>
            <ReaderOption label={t('Paper')} selected={!night} onPress={() => update({ theme: 'paper' })} />
            <ReaderOption label={t('Night')} selected={night} onPress={() => update({ theme: 'night' })} />
          </View>
        </View>
      </Sheet>

      {/* Book finished: one of the two earned events on the phone. The words are the trophy. */}
      <Sheet visible={finished} onClose={() => setFinished(false)}>
        <View style={styles.certificate}>
          <View style={styles.certificateInner}>
            <BrandMark size={44} />
            <Text style={styles.certificateEyebrow}>{t('READ TO THE END')}</Text>
            <Text style={styles.certificateTitle}>{params.title || shelfBook?.title || t('This book')}</Text>
            <Text style={styles.certificateMeta}>
              {shelfBook?.author ? `${shelfBook.author} · ` : ''}
              {t('{language} · read by @{username}', { language: languageName(sourceLanguage), username: profile?.username })}
            </Text>
            <View style={styles.certificateRule} />
            <View style={styles.certificateNumbers}>
              {!!shelfBook?.wordCount && (
                <Text style={styles.certificateNumber}>
                  <Text style={styles.certificateStrong}>{shelfBook.wordCount.toLocaleString()}</Text>{' '}
                  {t('{count, plural, one {word read} other {words read}}', { count: shelfBook.wordCount })}
                </Text>
              )}
              <Text style={styles.certificateNumber}>
                <Text style={styles.certificateStrong}>{savedInLanguage}</Text> {t('saved')}
              </Text>
              <Text style={styles.certificateNumber}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            </View>
          </View>
        </View>
        <Button onPress={() => { setFinished(false); router.replace('/(tabs)/books'); }}>{t('Back to your shelf')}</Button>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void Share.share({
              message: t('I read {title} to the end in {language} on Almonium.', {
                title: params.title || shelfBook?.title || t('a book'),
                language: languageName(sourceLanguage),
              }),
            }).catch(() => undefined)
          }
          style={styles.shareAction}>
          <Text style={styles.capLink}>{t('Share')}</Text>
        </Pressable>
      </Sheet>

      <PaywallModal context={paywallContext ?? 'general'} visible={Boolean(paywallContext)} onClose={() => setPaywallContext(null)} />
    </View>
  );
}

/** A bottom-bar toggle: icon and label in a pill, tinted while its sheet is open. */
function ChromePill({ icon, label, active, night, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; active: boolean; night: boolean; onPress(): void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const ink = active ? (night ? darkColors.primary : colors.primary) : night ? colors.white : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: active }} onPress={onPress}
      style={({ pressed }) => [styles.pill, night && styles.pillNight, active && (night ? styles.pillActiveNight : styles.pillActive), pressed && styles.pillPressed]}>
      <Ionicons name={icon} size={17} color={ink} />
      <Text style={[styles.pillText, { color: ink }]}>{label}</Text>
    </Pressable>
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
  topChrome: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomChrome: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  readerHeader: { backgroundColor: colors.canvas },
  readerBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line },
  barSpacer: { flex: 1 },
  pill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillNight: { backgroundColor: darkColors.surface, borderColor: darkColors.border },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  pillActiveNight: { borderColor: darkColors.primary, backgroundColor: darkColors.accentSoft },
  pillPressed: { opacity: 0.75 },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22, lineHeight: serifLineHeight(22) },
  sheetSubtitle: { color: colors.metadata, fontFamily: fonts.mono, fontSize: 12, marginTop: 2 },
  sheetClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  contentsList: { gap: 2 },
  contentsRow: { minHeight: 44, justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  contentsRowOpen: { backgroundColor: colors.accentSoft },
  contentsRowCurrent: { backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  contentsRowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  contentsTitle: { flex: 1, color: colors.ink, fontSize: 15.5 },
  contentsTitleCurrent: { fontFamily: fonts.sansSemibold, color: colors.primary },
  levelTag: { color: colors.metadata, fontFamily: fonts.mono, fontSize: 12 },
  contentsDescription: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  wordsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordsChapter: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, lineHeight: serifLineHeight(20) },
  arrowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  arrowDisabled: { opacity: 0.35 },
  wordsList: { borderRadius: 20, paddingHorizontal: 4, backgroundColor: colors.surface, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  wordRow: { gap: 5, paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, borderRadius: 14 },
  wordRowFirst: { borderTopWidth: 0 },
  wordHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  wordLemma: { color: colors.ink, fontFamily: fonts.serif, fontSize: 18, lineHeight: serifLineHeight(18) },
  wordSurface: { color: colors.metadata, fontFamily: fonts.mono, fontSize: 12 },
  savedMark: { color: colors.metadata, fontSize: 11.5, fontFamily: fonts.sansMedium },
  wordExcerpt: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  wordMatch: { backgroundColor: colors.accentSoft, color: colors.ink },
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
  sheetEntry: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: serifLineHeight(30) },
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
  certificateTitle: { color: lightColors.ink, fontFamily: fonts.serif, fontSize: 26, lineHeight: serifLineHeight(26), textAlign: 'center' },
  certificateMeta: { color: lightColors.muted, fontFamily: fonts.serifRegular, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  certificateRule: { width: 100, height: 1, backgroundColor: '#612B5E', opacity: 0.5, marginVertical: 4 },
  certificateNumbers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  certificateNumber: { color: lightColors.muted, fontFamily: fonts.serifRegular, fontSize: 13 },
  certificateStrong: { color: lightColors.ink, fontFamily: fonts.serif },
  shareAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));

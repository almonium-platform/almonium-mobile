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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { ReadingProgressSync } from '@/src/reading-progress';
import { colors } from '@/src/theme';

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

function appearanceScript(fontSize: number, theme: ReaderTheme, progress: number) {
  const background = theme === 'night' ? '#241f25' : colors.surface;
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
  const bookId = Number(params.bookId);
  const { firebaseUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const webView = useRef<WebView>(null);
  const sync = useMemo(
    () =>
      Number.isInteger(bookId) && firebaseUser
        ? new ReadingProgressSync(bookId, firebaseUser.uid)
        : null,
    [bookId, firebaseUser],
  );
  const [progress, setProgress] = useState<number | null>(null);
  const progressRef = useRef(0);
  const [fontSize, setFontSize] = useState(20);
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [parallel, setParallel] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textQuery = useQuery({
    queryKey: ['book-text', firebaseUser?.uid, bookId],
    queryFn: () => api.bookText(bookId),
    enabled: Number.isInteger(bookId) && bookId > 0 && Boolean(firebaseUser),
    staleTime: 10 * 60_000,
  });
  const infoQuery = useQuery({
    queryKey: ['book-info', firebaseUser?.uid, bookId],
    queryFn: () => api.bookInfo(bookId),
    enabled: Number.isInteger(bookId) && bookId > 0 && Boolean(firebaseUser),
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
    const percentage = Number(event.nativeEvent.data);
    if (!sync || !Number.isFinite(percentage)) return;
    const next = Math.max(0, Math.min(100, Math.round(percentage)));
    progressRef.current = next;
    setProgress(next);
    void sync.record(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 1500);
  }

  if (!Number.isInteger(bookId) || bookId <= 0) {
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
      <Stack.Screen options={{ title: params.title || 'Reader' }} />
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
          <WebView
            key={parallel ? `parallel-${parallelLanguage}` : 'single'}
            ref={webView}
            source={{ html: readerHtml(content) }}
            injectedJavaScript={`${appearanceScript(fontSize, theme, progress)}${baseProgressScript}true;`}
            onMessage={onProgress}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith('about:blank')) return true;
              if (/^https?:|^mailto:/i.test(request.url)) void Linking.openURL(request.url);
              return false;
            }}
            originWhitelist={['about:*']}
            style={styles.webview}
          />
          <View style={[styles.toolbar, theme === 'night' && styles.toolbarNight]}>
            <View style={styles.progressCopy}>
              <Text style={[styles.progressValue, theme === 'night' && styles.nightText]}>
                {progress}%
              </Text>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${progress}%` }]} />
              </View>
            </View>
            <Pressable
              accessibilityLabel="Toggle parallel translation"
              disabled={!parallelLanguage}
              onPress={() => setParallel((value) => !value)}
              style={[styles.toolButton, !parallelLanguage && styles.toolButtonDisabled]}>
              <Ionicons
                name={parallel ? 'git-compare' : 'git-compare-outline'}
                size={20}
                color={
                  parallel
                    ? colors.primary
                    : theme === 'night'
                      ? colors.white
                      : colors.ink
                }
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Decrease text size"
              onPress={() => setFontSize((size) => Math.max(16, size - 2))}
              style={styles.toolButton}>
              <Text style={[styles.smallA, theme === 'night' && styles.nightText]}>A</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Increase text size"
              onPress={() => setFontSize((size) => Math.min(30, size + 2))}
              style={styles.toolButton}>
              <Text style={[styles.largeA, theme === 'night' && styles.nightText]}>A</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Toggle reader theme"
              onPress={() => setTheme((value) => (value === 'paper' ? 'night' : 'paper'))}
              style={styles.toolButton}>
              <Ionicons
                name={theme === 'paper' ? 'moon-outline' : 'sunny-outline'}
                size={20}
                color={theme === 'night' ? colors.white : colors.ink}
              />
            </Pressable>
          </View>
        </>
      )}
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
  toolbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 5, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  toolbarNight: { backgroundColor: '#302a31', borderTopColor: '#4c414b' },
  progressCopy: { flex: 1, gap: 5 },
  progressValue: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.reading },
  toolButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  toolButtonDisabled: { opacity: 0.3 },
  smallA: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  largeA: { color: colors.ink, fontSize: 21, fontWeight: '600' },
  nightText: { color: colors.white },
});

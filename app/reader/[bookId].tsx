import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { api } from '@/src/api';
import { colors } from '@/src/theme';

const readerScript = `
  (function () {
    let last = -1;
    function report() {
      const root = document.documentElement;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const percentage = Math.max(0, Math.min(100, Math.round((window.scrollY / max) * 100)));
      if (Math.abs(percentage - last) >= 2) {
        last = percentage;
        window.ReactNativeWebView.postMessage(String(percentage));
      }
    }
    document.addEventListener('scroll', report, { passive: true });
    window.addEventListener('load', report);
    true;
  })();
`;

function readerHtml(content: string) {
  const isDocument = /<html[\s>]/i.test(content);
  if (isDocument) return content;
  return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>
          :root { color-scheme: light; }
          body {
            margin: 0 auto;
            padding: 28px 24px 100px;
            max-width: 720px;
            background: #fffdf8;
            color: #202824;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 20px;
            line-height: 1.72;
          }
          h1, h2, h3 { color: #17221d; line-height: 1.2; margin-top: 1.8em; }
          p { margin: 0 0 1.15em; }
          img { max-width: 100%; height: auto; }
          a { color: #26735b; }
        </style>
      </head>
      <body>${content}</body>
    </html>`;
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ bookId: string; language?: string; title?: string }>();
  const bookId = Number(params.bookId);
  const queryClient = useQueryClient();
  const latestProgress = useRef<number | null>(null);
  const lastSaved = useRef(-1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ['book-text', bookId],
    queryFn: () => api.bookText(bookId),
    enabled: Number.isFinite(bookId),
  });

  const save = useCallback(
    async (percentage: number) => {
      if (Math.abs(percentage - lastSaved.current) < 2) return;
      lastSaved.current = percentage;
      await api.saveProgress(bookId, percentage);
      await queryClient.invalidateQueries({ queryKey: ['bookshelf'] });
    },
    [bookId, queryClient],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (latestProgress.current !== null) void save(latestProgress.current);
    },
    [save],
  );

  function onProgress(event: WebViewMessageEvent) {
    const percentage = Number(event.nativeEvent.data);
    if (!Number.isFinite(percentage)) return;
    latestProgress.current = percentage;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(percentage), 1500);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: params.title || 'Reader' }} />
      {query.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.status}>Opening your book…</Text>
        </View>
      )}
      {query.isError && (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>This page would not open.</Text>
          <Text style={styles.status}>
            {query.error instanceof Error ? query.error.message : 'Please try again.'}
          </Text>
        </View>
      )}
      {query.data && (
        <WebView
          source={{ html: readerHtml(query.data) }}
          injectedJavaScript={readerScript}
          onMessage={onProgress}
          originWhitelist={['*']}
          style={styles.webview}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  webview: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  status: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  errorTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
});

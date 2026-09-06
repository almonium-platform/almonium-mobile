import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import type { ReaderFace } from '@/src/reader-settings';

/**
 * The reader page is a WebView, which cannot see the fonts the app loaded, so the chosen face is
 * embedded as a data URI. One file per face, read once and kept for the session.
 */
const faceModules: Record<ReaderFace, { family: string; module: number }> = {
  literata: { family: 'Literata', module: require('@expo-google-fonts/literata/400Regular/Literata_400Regular.ttf') },
  plex: { family: 'IBM Plex Sans', module: require('@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf') },
  atkinson: {
    family: 'Atkinson Hyperlegible',
    module: require('@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf'),
  },
};

/** What the page falls back to while the file loads, or on web where the asset is a URL. */
export const faceStacks: Record<ReaderFace, string> = {
  literata: "'Literata', Georgia, 'Times New Roman', serif",
  plex: "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif",
  atkinson: "'Atkinson Hyperlegible', -apple-system, 'Segoe UI', sans-serif",
};

const cache = new Map<ReaderFace, Promise<string>>();

/** The `@font-face` rule for a face, or an empty string when it cannot be embedded. */
export function readerFaceCss(face: ReaderFace): Promise<string> {
  let pending = cache.get(face);
  if (!pending) {
    pending = loadFace(face).catch(() => '');
    cache.set(face, pending);
  }
  return pending;
}

async function loadFace(face: ReaderFace) {
  const { family, module } = faceModules[face];
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) return '';
  if (Platform.OS === 'web') {
    return `@font-face { font-family: '${family}'; src: url('${uri}') format('truetype'); }`;
  }
  const { File } = await import('expo-file-system');
  const base64 = await new File(uri).base64();
  return `@font-face { font-family: '${family}'; src: url('data:font/ttf;base64,${base64}') format('truetype'); font-display: swap; }`;
}

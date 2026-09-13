import { t } from './i18n';

export function formattedDownloadSize(bytes: number) {
  if (bytes < 1024) return t('{size} B', { size: bytes });
  if (bytes < 1024 * 1024) return t('{size} KB', { size: Math.max(1, Math.round(bytes / 1024)) });
  return t('{size} MB', { size: (bytes / (1024 * 1024)).toFixed(1) });
}

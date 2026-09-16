import AsyncStorage from '@react-native-async-storage/async-storage';

import { t } from './i18n';
import { languageName } from './languages';
import { isOtherEditionTranslation } from './reader-editions';
import type { BookEditionVariant } from './types';

/**
 * The companion is remembered per book (the mode per device, in the reader settings). The stored
 * value is the companion's edition slug, or {@link noCompanion} once the reader has asked to read
 * this book on its own.
 */
export const noCompanion = 'none';

const key = (bookId: string) => `almonium:reader-companion:${bookId}`;

export async function loadCompanionChoice(bookId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(bookId));
  } catch {
    return null;
  }
}

export async function saveCompanionChoice(bookId: string, choice: string) {
  try {
    await AsyncStorage.setItem(key(bookId), choice);
  } catch {
    // The choice then lasts the visit only.
  }
}

/** "EN C1": the codes the header shows either side of the arrow. */
export function editionCode(variant?: BookEditionVariant | null) {
  if (!variant) return '';
  return [variant.language.toUpperCase(), variant.cefrLevel].filter(Boolean).join(' ');
}

/** "Ukrainian · C1": the companion row's first line. */
export function editionName(variant: BookEditionVariant) {
  return [languageName(variant.language), variant.cefrLevel].filter(Boolean).join(' · ');
}

/** The edition type in words, the row's second line; an indirect translation says what it translates. */
export function editionTypeLabel(variant: BookEditionVariant, primary?: BookEditionVariant) {
  if (isOtherEditionTranslation(variant, primary)) return t('Translation of the original');
  switch (variant.editionType) {
    case 'machine_translation': return t('Machine translation');
    case 'human_translation': return t('Translation');
    case 'adaptation': return t('Adaptation');
    case 'original': return t('Original');
    default: return variant.editionType?.replaceAll('_', ' ') ?? '';
  }
}

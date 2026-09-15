import type { BookEditionVariant } from './types';

export function companionEditions(variants: BookEditionVariant[], primaryId: string) {
  return variants.filter(variant => variant.id !== primaryId && Boolean(variant.editionSlug));
}

export function chooseCompanion(variants: BookEditionVariant[], primaryId: string, requested: string | undefined, fluentLanguages: string[]) {
  const choices = companionEditions(variants, primaryId);
  return choices.find(variant => variant.editionSlug === requested)
    // Existing translation-request links specify their destination language.
    ?? choices.find(variant => variant.language === requested)
    ?? choices.find(variant => fluentLanguages.includes(variant.language));
}

export function editionLabel(variant: BookEditionVariant) {
  return [variant.language, variant.cefrLevel, variant.editionType?.replaceAll('_', ' ')].filter(Boolean).join(' · ');
}

export function parallelEditionPath(primarySlug: string, companionSlug: string) {
  return `/public/books/${encodeURIComponent(primarySlug)}/parallel-edition/${encodeURIComponent(companionSlug)}`;
}

import { msg } from './i18n';
import type {CefrLevel, Learner} from './types';

export interface LanguageVariety { tag: string; label: string; name: string }

// Keep selectable tags/default order aligned with backend LanguageVariety and the web catalogue.
export const languageVarieties: Record<string, readonly LanguageVariety[]> = {
  EN: [
    { tag: 'en-US', label: msg('American'), name: msg('American English') },
    { tag: 'en-GB', label: msg('British'), name: msg('British English') },
    { tag: 'en-AU', label: msg('Australian'), name: msg('Australian English') },
    { tag: 'en-IN', label: msg('Indian'), name: msg('Indian English') },
  ],
  ES: [
    { tag: 'es-ES', label: msg('Spain'), name: msg('European Spanish') },
    { tag: 'es-MX', label: msg('Mexico'), name: msg('Mexican Spanish') },
    { tag: 'es-AR', label: msg('Argentina'), name: msg('Argentine Spanish') },
    { tag: 'es-CO', label: msg('Colombia'), name: msg('Colombian Spanish') },
  ],
  PT: [
    { tag: 'pt-BR', label: msg('Brazil'), name: msg('Brazilian Portuguese') },
    { tag: 'pt-PT', label: msg('Portugal'), name: msg('European Portuguese') },
  ],
  FR: [
    { tag: 'fr-FR', label: msg('France'), name: msg('French of France') },
    { tag: 'fr-CA', label: msg('Canada'), name: msg('Canadian French') },
    { tag: 'fr-BE', label: msg('Belgium'), name: msg('Belgian French') },
    { tag: 'fr-CH', label: msg('Switzerland'), name: msg('Swiss French') },
  ],
  DE: [
    { tag: 'de-DE', label: msg('Germany'), name: msg('German of Germany') },
    { tag: 'de-AT', label: msg('Austria'), name: msg('Austrian German') },
    { tag: 'de-CH', label: msg('Switzerland'), name: msg('Swiss Standard German') },
  ],
  NL: [
    { tag: 'nl-NL', label: msg('Netherlands'), name: msg('Dutch of the Netherlands') },
    { tag: 'nl-BE', label: msg('Belgium'), name: msg('Belgian Dutch') },
  ],
  ZH: [
    { tag: 'zh-CN', label: msg('Mainland'), name: msg('Mainland Chinese') },
    { tag: 'zh-TW', label: msg('Taiwan'), name: msg('Taiwanese Mandarin') },
  ],
};

export function selectedVariety(language: string, tag?: string | null): LanguageVariety | undefined {
  const choices = languageVarieties[language];
  return choices?.find(choice => choice.tag.toLowerCase() === tag?.toLowerCase()) ?? choices?.[0];
}

/** Preserve each language's saved level and variety when resuming onboarding on another client. */
export function onboardingLanguageUpdates(learners: Learner[], levels: Record<string, CefrLevel>, varieties: Record<string, string>) {
  return learners.map(learner => ({
    language: learner.language,
    cefrLevel: levels[learner.language] ?? learner.selfReportedLevel,
    variety: selectedVariety(learner.language, varieties[learner.language] ?? learner.variety)?.tag,
  }));
}

/** Configured pronunciation support; availability is not a live provider health check. */
export interface VoiceAvailability {
  language: string;
  variety: string;
  defaultVariety: boolean;
  available: boolean;
  unavailableReason: 'NO_ENABLED_VOICE' | null;
  provider: 'GOOGLE' | null;
  languageCode: string | null;
  voiceId: string | null;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL' | null;
}

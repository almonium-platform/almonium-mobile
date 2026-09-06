import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { hasTarget, localDate, type LanguageRhythm, type Rhythm, type WeeklyTarget } from '@/src/rhythm';

/**
 * One loaded rhythm shared by home, the record page and the profile, so a target can never
 * disagree with itself across surfaces.
 */
export function useRhythm() {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ['rhythm', firebaseUser?.uid],
    queryFn: () => api.rhythm(localDate()),
    enabled: Boolean(firebaseUser),
  });
}

export function rhythmFor(rhythm: Rhythm | undefined, language: string | null | undefined): LanguageRhythm | null {
  if (!rhythm || !language) return null;
  return rhythm.languages.find((entry) => entry.language === language) ?? null;
}

/** Moving one language's bar re-judges its weeks against it; the days themselves are untouched. */
export function useSetRhythmTarget() {
  const { firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const key = ['rhythm', firebaseUser?.uid];
  return useMutation({
    mutationFn: ({ language, target }: { language: string; target: WeeklyTarget }) =>
      api.setRhythmTarget(language, target),
    onSuccess: (_, { language, target }) => {
      queryClient.setQueryData<Rhythm>(key, (current) =>
        current
          ? {
              languages: current.languages.map((entry) =>
                entry.language !== language
                  ? entry
                  : {
                      ...entry,
                      target,
                      weeks: entry.weeks.map((week) => ({
                        ...week,
                        met: hasTarget(target) && week.daysMet >= target,
                      })),
                    },
              ),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useLearningStats(language: string | null | undefined) {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ['learning-stats', firebaseUser?.uid, language],
    queryFn: () => api.learningStats(language!),
    enabled: Boolean(firebaseUser && language),
  });
}

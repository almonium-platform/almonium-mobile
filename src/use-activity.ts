import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { api } from '@/src/api';
import { ActivityMeter, localDate, type ActivitySource } from '@/src/rhythm';

const reportEveryMs = 60_000;

/**
 * Reports time on task to the harness while a screen is open. Call `tick()` whenever the learner
 * does something; the meter drops idle gaps on its own, and what has accumulated is sent once a
 * minute, when the app goes to the background, and when the screen closes. `complete()` closes a
 * discrete event, such as a finished session or a finished book.
 */
export function useLearningActivity(source: ActivitySource, language: string | null | undefined) {
  const queryClient = useQueryClient();
  const meter = useRef(new ActivityMeter());
  const languageRef = useRef(language);
  languageRef.current = language;

  const report = useCallback(
    async (completed = false) => {
      const seconds = meter.current.take();
      if (!languageRef.current || (!seconds && !completed)) return;
      try {
        await api.recordActivity({ source, language: languageRef.current, seconds, localDate: localDate(), completed });
        await queryClient.invalidateQueries({ queryKey: ['rhythm'] });
      } catch {
        // A missed report is a few seconds of texture, never a lost record.
      }
    },
    [queryClient, source],
  );

  useEffect(() => {
    const interval = setInterval(() => void report(), reportEveryMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') meter.current.pause();
      else void report();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      void report();
    };
  }, [report]);

  return {
    tick: () => meter.current.tick(),
    complete: () => report(true),
  };
}

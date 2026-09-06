import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native';

import { ActionPill, Row, Section } from '@/components/settings/shared';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { config } from '@/src/config';
import { useNotice } from '@/src/notice-context';
import { downloadedBooks, formattedDownloadSize, removeDownloadedBook } from '@/src/offline-books';
import {
  defaultReaderSettings,
  loadReaderSettings,
  parallelModes,
  readerFaces,
  saveReaderSettings,
  type ReaderSettings,
} from '@/src/reader-settings';
import { configureDailyReminder, getReminderSettings, reminderTimeLabel } from '@/src/reminders';
import { createThemedStyles, useTheme, type AppearancePreference, type MotionPreference } from '@/src/theme';

const reminderHours = [8, 12, 18, 20, 21];

/**
 * What you cannot preview: theme, motion, notifications, reader defaults, data. Size and width
 * live in the reader, where the effect is visible. Account and billing mail is listed as always
 * sent, so its absence reads as a decision rather than an omission.
 */
export function AppTab() {
  const { appearance, colors, motion, setAppearance, setMotion } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const showNotice = useNotice();
  const queryClient = useQueryClient();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState('');
  const [socialEmails, setSocialEmails] = useState(profile?.notifications?.socialEmails ?? true);
  const [savingSocial, setSavingSocial] = useState(false);
  const [reader, setReader] = useState<ReaderSettings>(defaultReaderSettings);
  const [exporting, setExporting] = useState(false);
  const downloads = useQuery({ queryKey: ['offline-books'], queryFn: downloadedBooks });
  const cardQueries = useQueries({
    queries: (profile?.learners ?? []).map((learner) => ({
      queryKey: ['cards', firebaseUser?.uid, learner.language],
      queryFn: () => api.cards(learner.language),
      enabled: Boolean(firebaseUser),
    })),
  });

  useEffect(() => {
    void getReminderSettings().then((settings) => {
      setReminderEnabled(settings.enabled);
      setReminderHour(settings.hour);
    });
    void loadReaderSettings().then(setReader);
  }, []);
  useEffect(() => setSocialEmails(profile?.notifications?.socialEmails ?? true), [profile?.notifications?.socialEmails]);

  async function saveReminder(enabled: boolean, hour = reminderHour) {
    const previous = { enabled: reminderEnabled, hour: reminderHour };
    setReminderEnabled(enabled);
    setReminderHour(hour);
    setSavingReminder(true);
    setReminderError('');
    try {
      const settings = await configureDailyReminder(enabled, hour);
      setReminderEnabled(settings.enabled);
      setReminderHour(settings.hour);
    } catch (error) {
      setReminderEnabled(previous.enabled);
      setReminderHour(previous.hour);
      setReminderError(error instanceof Error ? error.message : 'The reminder could not be changed.');
    } finally {
      setSavingReminder(false);
    }
  }

  async function saveSocialEmails(value: boolean) {
    setSocialEmails(value);
    setSavingSocial(true);
    try {
      await api.updateSocialEmails(value);
      await refreshProfile();
    } catch (error) {
      setSocialEmails(!value);
      showNotice({ title: 'Could not update email settings', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setSavingSocial(false);
    }
  }

  function updateReader(patch: Partial<ReaderSettings>) {
    const next = { ...reader, ...patch };
    setReader(next);
    void saveReaderSettings(next);
  }

  async function exportWords() {
    setExporting(true);
    try {
      const rows = cardQueries.flatMap((query) => query.data ?? []);
      if (!rows.length) {
        showNotice({ title: 'Nothing to export yet', message: 'Keep a word first.' });
        return;
      }
      const escape = (value: string | undefined) => `"${(value ?? '').replace(/"/g, '""')}"`;
      const csv = [
        ['entry', 'language', 'translations', 'part_of_speech', 'sense', 'source_sentence', 'tags', 'kept_at'].join(','),
        ...rows.map((item) =>
          [
            escape(item.entry),
            escape(item.language),
            escape(item.translations.map((translation) => translation.translation).join('; ')),
            escape(item.partOfSpeech),
            escape(item.selectedSense),
            escape(item.sourceContext),
            escape(item.tags?.map((tag) => tag.text).filter(Boolean).join('; ')),
            escape(item.createdAt),
          ].join(','),
        ),
      ].join('\n');
      const { File, Paths } = await import('expo-file-system');
      const Sharing = await import('expo-sharing');
      const file = new File(Paths.cache, `almonium-words-${new Date().toISOString().slice(0, 10)}.csv`);
      file.create({ overwrite: true });
      file.write(csv);
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export my words' });
    } catch (error) {
      showNotice({ title: 'Could not export', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setExporting(false);
    }
  }

  async function clearDownloads() {
    try {
      await Promise.all((downloads.data ?? []).map((book) => removeDownloadedBook(book.id)));
      await queryClient.invalidateQueries({ queryKey: ['offline-books'] });
    } catch (error) {
      showNotice({ title: 'Could not clear downloads', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    }
  }

  const downloadSize = (downloads.data ?? []).reduce((total, book) => total + book.size, 0);
  const switchColors = {
    trackColor: { false: colors.line, true: colors.accentBorder },
    ios_backgroundColor: colors.line,
  };

  return (
    <View style={styles.tab}>
      <Section eyebrow="APPEARANCE">
        <Row label="Theme">
          <Segmented<AppearancePreference>
            value={appearance}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]}
            onChange={(value) => void setAppearance(value)}
          />
        </Row>
        <Row label="Reduce motion" detail="Stops slides and anything that moves across the screen. Fades and colour changes stay.">
          <Segmented<MotionPreference>
            value={motion}
            options={[{ value: 'full', label: 'Off' }, { value: 'reduced', label: 'On' }, { value: 'system', label: 'System' }]}
            onChange={(value) => void setMotion(value)}
          />
        </Row>
      </Section>

      <Section eyebrow="NOTIFICATIONS">
        <Row label="Daily review nudge" detail="One notification, at a time you pick. Nothing to lose by missing it.">
          <Switch
            disabled={savingReminder || Platform.OS === 'web'}
            value={reminderEnabled}
            onValueChange={(enabled) => void saveReminder(enabled)}
            thumbColor={reminderEnabled ? colors.primary : colors.muted}
            {...switchColors}
          />
        </Row>
        {reminderEnabled && (
          <View style={styles.times}>
            {reminderHours.map((hour) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: reminderHour === hour }}
                disabled={savingReminder}
                key={hour}
                onPress={() => void saveReminder(true, hour)}
                style={[styles.time, reminderHour === hour && styles.timeActive]}>
                <Text style={[styles.timeText, reminderHour === hour && styles.timeTextActive]}>{reminderTimeLabel(hour)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {!!reminderError && <Text accessibilityRole="alert" style={styles.error}>{reminderError}</Text>}
        <Row label="Connection requests" detail="Email when someone asks to connect, and when they accept.">
          <Switch
            disabled={savingSocial}
            value={socialEmails}
            onValueChange={(value) => void saveSocialEmails(value)}
            thumbColor={socialEmails ? colors.primary : colors.muted}
            {...switchColors}
          />
        </Row>
        <Row label="Account and billing email" detail="Always sent." />
      </Section>

      <Section eyebrow="READER DEFAULTS">
        <Text style={styles.note}>Size lives in the reader, where you can see the effect.</Text>
        <View style={styles.group}>
          <Text style={styles.groupLabel}>TYPE</Text>
          {readerFaces.map((face) => {
            const selected = reader.face === face.value;
            return (
              <Pressable key={face.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => updateReader({ face: face.value })} style={[styles.option, selected && styles.optionSelected]}>
                <View style={[styles.dot, selected && styles.dotSelected]} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{face.label}</Text>
                  {!!face.note && <Text style={styles.optionNote}>{face.note}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.group}>
          <Text style={styles.groupLabel}>TRANSLATION</Text>
          {parallelModes.map((mode) => {
            const selected = reader.parallel === mode.value;
            return (
              <Pressable key={mode.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => updateReader({ parallel: mode.value })} style={[styles.option, selected && styles.optionSelected]}>
                <View style={[styles.dot, selected && styles.dotSelected]} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{mode.label}</Text>
                  <Text style={styles.optionNote}>{mode.note}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Row label="Page">
          <Segmented<ReaderSettings['theme']>
            value={reader.theme}
            options={[{ value: 'paper', label: 'Paper' }, { value: 'night', label: 'Night' }]}
            onChange={(theme) => updateReader({ theme })}
          />
        </Row>
      </Section>

      <Section eyebrow="DATA & STORAGE">
        <Row label="Export my words" detail="CSV, every language.">
          <ActionPill label="Export" busy={exporting} onPress={() => void exportWords()} />
        </Row>
        <Row
          label="Offline books"
          detail={downloads.data?.length ? `${downloads.data.length} ${downloads.data.length === 1 ? 'book' : 'books'} · ${formattedDownloadSize(downloadSize)}` : 'Nothing downloaded'}>
          {!!downloads.data?.length && <ActionPill label="Clear" onPress={() => void clearDownloads()} />}
        </Row>
      </Section>

      <Section eyebrow="LEGAL">
        <Row label="Privacy policy" onPress={() => void Linking.openURL(`${config.webBaseUrl}/privacy-policy`)}>
          <Ionicons name="open-outline" size={18} color={colors.muted} />
        </Row>
        <Row label="Terms of use" onPress={() => void Linking.openURL(`${config.webBaseUrl}/terms-of-use`)}>
          <Ionicons name="open-outline" size={18} color={colors.muted} />
        </Row>
      </Section>
    </View>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange(value: T): void }) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  tab: { gap: 18 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 6 },
  time: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999 },
  timeActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  timeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  timeTextActive: { color: colors.primary },
  group: { gap: 4, paddingVertical: 6 },
  groupLabel: { color: colors.metadata, fontSize: 10.5, fontWeight: '600', letterSpacing: 1.3, paddingBottom: 4 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  optionSelected: { backgroundColor: colors.accentSoft },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  dotSelected: { borderWidth: 6, borderColor: colors.primary },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { color: colors.ink, fontSize: 15 },
  optionNote: { color: colors.metadata, fontSize: 12, lineHeight: 17 },
  segmented: { flexDirection: 'row', borderRadius: 999, padding: 3, backgroundColor: colors.nested },
  segment: { minHeight: 32, minWidth: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999 },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  segmentTextSelected: { color: colors.primaryDark },
}));

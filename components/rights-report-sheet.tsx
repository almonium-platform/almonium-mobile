import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Button, Field } from '@/components/ui';
import { api } from '@/src/api';
import { httpStatus } from '@/src/http-errors';
import {
  countryName,
  countryOptions,
  matchCountries,
  type ReporterRole,
  reportFailure,
  reportMessageMax,
  reportMissing,
  reportNameMax,
  reportRequest,
  reporterRoles,
  reportThanks,
} from '@/src/rights-report';
import { createThemedStyles, fonts, serifLineHeight } from '@/src/theme';

/**
 * "Report a problem with this book's rights": a sheet open to guests and members alike. A guest
 * leaves an email; a member is known by the account. Send stays greyed with one line saying what
 * is missing; once the report is in, the form gives way to the thanks.
 */
export function RightsReportSheet({
  visible,
  onClose,
  editionSlug,
  bookTitle,
  guest,
}: {
  visible: boolean;
  onClose(): void;
  editionSlug: string;
  bookTitle: string;
  guest: boolean;
}) {
  // A fresh form each time the sheet opens; the last one stays put while the sheet drops away.
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (visible) setRound((current) => current + 1);
  }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <RightsReportForm key={round} editionSlug={editionSlug} bookTitle={bookTitle} guest={guest} onClose={onClose} />
    </Sheet>
  );
}

function RightsReportForm({ editionSlug, bookTitle, guest, onClose }: { editionSlug: string; bookTitle: string; guest: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [role, setRole] = useState<ReporterRole | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [message, setMessage] = useState('');
  const countries = useMemo(() => countryOptions(), []);
  const matches = useMemo(() => matchCountries(countries, countrySearch), [countries, countrySearch]);
  const missing = reportMissing({ role, email, message, guest });

  const send = useMutation({
    mutationFn: () => {
      if (role === null) throw new Error(t('Say who you are.'));
      return api.reportRights(editionSlug, reportRequest({ role, name, email, country, message, guest }));
    },
  });

  if (send.isSuccess) {
    return (
      <>
        <Text accessibilityRole="header" style={styles.title}>{t('Report a problem with this book’s rights')}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.copy}>{reportThanks(send.data?.contact)}</Text>
        <Button onPress={onClose}>{t('Close')}</Button>
      </>
    );
  }

  const failure = send.isError
    ? reportFailure(httpStatus(send.error), send.error instanceof Error ? send.error.message : null)
    : null;

  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>{t('Report a problem with this book’s rights')}</Text>
      {!!bookTitle && <Text style={styles.copy}>{t('About {title}. A person reads every report.', { title: bookTitle })}</Text>}

      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t('Who are you?')}>
        <Text style={styles.label}>{t('Who are you?')}</Text>
        {reporterRoles.map((option) => {
          const selected = role === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setRole(option.value)}
              style={({ pressed }) => [styles.radio, selected && styles.radioSelected, pressed && styles.pressed]}>
              <View style={[styles.radioDot, selected && styles.radioDotSelected]}>{selected && <View style={styles.radioDotInner} />}</View>
              <Text style={styles.radioText}>{t(option.label)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>
          {t('Name')} <Text style={styles.optional}>{t('optional')}</Text>
        </Text>
        <Field value={name} onChangeText={setName} maxLength={reportNameMax} autoCapitalize="words" autoComplete="name" textContentType="name" accessibilityLabel={t('Name')} />
      </View>

      {guest && (
        <View style={styles.group}>
          <Text style={styles.label}>{t('Email')}</Text>
          <Field value={email} onChangeText={setEmail} placeholder={t('you@example.com')} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel={t('Email')} />
        </View>
      )}

      <View style={styles.group}>
        <Text style={styles.label}>{t('Which country is it about?')}</Text>
        <View style={styles.chips}>
          <CountryChip label={t('Everywhere')} selected={country === ''} onPress={() => setCountry('')} />
          {!!country && <CountryChip label={countryName(country)} selected onPress={() => undefined} />}
        </View>
        <Field
          value={countrySearch}
          onChangeText={setCountrySearch}
          placeholder={t('Search for a country')}
          autoCorrect={false}
          accessibilityLabel={t('Search for a country')}
        />
        {matches.length > 0 && (
          <View style={styles.chips}>
            {matches.map((option) => (
              <CountryChip
                key={option.code}
                label={option.name}
                selected={country === option.code}
                onPress={() => {
                  setCountry(option.code);
                  setCountrySearch('');
                }}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('What is wrong?')}</Text>
        <Field value={message} onChangeText={setMessage} multiline maxLength={reportMessageMax} autoCapitalize="sentences" textAlignVertical="top" accessibilityLabel={t('What is wrong?')} />
      </View>

      {!!failure && <Text accessibilityRole="alert" style={styles.error}>{failure}</Text>}

      <Button disabled={missing !== null} loading={send.isPending} onPress={() => send.mutate()}>{t('Send')}</Button>
      {missing !== null && <Text style={styles.hint}>{missing}</Text>}
      <Button variant="text" onPress={onClose}>{t('Cancel')}</Button>
    </>
  );
}

function CountryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22, lineHeight: serifLineHeight(22) },
  copy: { color: colors.muted, fontSize: 14.5, lineHeight: 21 },
  group: { gap: 8 },
  label: { color: colors.ink, fontFamily: fonts.sansSemibold, fontSize: 13.5 },
  optional: { color: colors.muted, fontFamily: fonts.sans, fontStyle: 'italic' },
  radio: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  radioDot: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  radioDotSelected: { borderColor: colors.primary },
  radioDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  radioText: { flex: 1, color: colors.ink, fontSize: 14.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontFamily: fonts.sansSemibold, fontSize: 12.5 },
  chipTextSelected: { color: colors.primary },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger, fontSize: 13.5, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
}));

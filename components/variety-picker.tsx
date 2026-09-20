import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { languageVarieties, selectedVariety } from '@/src/language-varieties';
import { languageName } from '@/src/languages';
import { createThemedStyles, fonts } from '@/src/theme';

export function VarietyPicker({language, value, onChange, disabled = false}: {
  language: string; value?: string | null; onChange: (tag: string) => void; disabled?: boolean;
}) {
  const {t} = useTranslation();
  const styles = useStyles();
  const choices = languageVarieties[language];
  if (!choices || choices.length < 2) return null;
  const selected = selectedVariety(language, value)?.tag;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Which {language}?', {language: languageName(language)})}</Text>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {choices.map(choice => (
          <Pressable key={choice.tag} accessibilityRole="radio" accessibilityLabel={t(choice.name)}
            accessibilityState={{checked: selected === choice.tag, disabled}} disabled={disabled}
            onPress={() => onChange(choice.tag)}
            style={({pressed}) => [styles.pill, selected === choice.tag && styles.selected, (disabled || pressed) && styles.dim]}>
            <Text style={[styles.label, selected === choice.tag && styles.selectedLabel]}>{t(choice.label)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.helper}>{language === 'DE'
        ? t('Switzerland means Swiss Standard German, not dialect. Pronunciation is available only where a matching voice is supported.')
        : t('Saves the variety you are learning. Pronunciation uses this choice where audio is available.')}</Text>
    </View>
  );
}

const useStyles = createThemedStyles(colors => ({
  container: {gap: 10},
  title: {fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink},
  choices: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.nested},
  selected: {backgroundColor: colors.primary},
  label: {fontFamily: fonts.sans, color: colors.ink},
  selectedLabel: {color: colors.onPrimary},
  helper: {fontFamily: fonts.sans, color: colors.muted, fontSize: 12, lineHeight: 18},
  dim: {opacity: 0.6},
}));

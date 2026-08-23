import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import { colors, fonts, gradients, radii, shadows } from '@/src/theme';

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Field(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      {...props}
      style={[styles.field, props.style]}
    />
  );
}

export function Button({
  children,
  loading,
  variant = 'primary',
  ...props
}: Omit<ComponentProps<typeof Pressable>, 'children'> & {
  children: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'premium' | 'secondary' | 'danger';
}) {
  const disabled = Boolean(props.disabled || loading);
  const content = loading ? (
    <ActivityIndicator
      color={
        disabled
          ? colors.disabledText
          : variant === 'primary' || variant === 'premium'
          ? colors.white
          : variant === 'danger'
            ? colors.danger
            : colors.ink
      }
    />
  ) : (
    <Text
      style={[
        styles.buttonText,
        variant === 'secondary' && styles.buttonTextSecondary,
        variant === 'danger' && styles.buttonTextDanger,
        disabled && styles.buttonTextDisabled,
      ]}>
      {children}
    </Text>
  );

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        pressed && variant === 'primary' && styles.buttonPrimaryPressed,
        pressed && variant !== 'primary' && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {variant === 'premium' && !disabled ? (
        <LinearGradient
          colors={gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonFill}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 39,
    color: colors.ink,
  },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { color: colors.muted },
  card: {
    borderRadius: radii.card,
    padding: 20,
    gap: 16,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  field: {
    minHeight: 54,
    borderRadius: radii.control,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: fonts.sans,
    color: colors.ink,
    backgroundColor: colors.white,
    ...shadows.field,
  },
  button: {
    minHeight: 54,
    borderRadius: radii.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFill: {
    minHeight: 54,
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { paddingHorizontal: 24, backgroundColor: colors.primary },
  buttonPrimaryPressed: { backgroundColor: colors.primaryPressed },
  buttonSecondary: {
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.white,
  },
  buttonDanger: {
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.white,
  },
  buttonText: { color: colors.white, fontFamily: fonts.sansSemibold, fontSize: 16 },
  buttonTextSecondary: { color: colors.ink },
  buttonTextDanger: { color: colors.danger },
  buttonTextDisabled: { color: colors.disabledText },
  pressed: { opacity: 0.75 },
  disabled: { paddingHorizontal: 24, backgroundColor: colors.disabled, borderColor: colors.disabled },
});

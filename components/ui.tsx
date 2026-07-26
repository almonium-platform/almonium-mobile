import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import { colors, shadows } from '@/src/theme';

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
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      {...props}
      disabled={props.disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.pressed,
        (props.disabled || loading) && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { color: colors.muted },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.mint,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  buttonTextSecondary: { color: colors.primaryDark },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});

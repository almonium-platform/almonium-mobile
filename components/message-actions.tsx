import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createThemedStyles, fonts, useTheme } from '@/src/theme';

export interface MessageAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  run(): void;
}

/**
 * Long-press replaces the desktop hover menu, with the same actions in the same order. The
 * pressed bubble is handed in and stays lit above the scrim so it is clear which message is
 * being acted on; the rest of the thread dims but is not blurred.
 */
export function MessageActionsSheet({
  visible,
  actions,
  children,
  onClose,
}: {
  visible: boolean;
  actions: MessageAction[];
  children?: React.ReactNode;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Dismiss" style={styles.scrim} onPress={onClose} />
      {/* The pressed bubble sits directly above the sheet, lit over the dimmed thread. */}
      <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.sheetLayer}>
        <View style={styles.lifted} pointerEvents="box-none">
          {children}
        </View>
        <View style={styles.sheet}>
          {actions.map((action, index) => (
            <View key={action.key}>
              {index > 0 && <View style={styles.rule} />}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  action.run();
                }}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <Ionicons name={action.icon} size={17} color={colors.muted} />
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        {/* iOS convention; on Android the back gesture dismisses. */}
        {Platform.OS === 'ios' && (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors, isDark) => ({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? 'rgba(10,8,14,0.5)' : 'rgba(44,37,48,0.32)' },
  lifted: { paddingHorizontal: 6, paddingBottom: 12 },
  sheetLayer: { position: 'absolute', right: 0, bottom: 0, left: 0, gap: 8, paddingHorizontal: 10, paddingBottom: 10 },
  sheet: { borderRadius: 16, padding: 6, backgroundColor: colors.surface },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 12 },
  actionText: { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 14.5 },
  rule: { height: 1, marginHorizontal: 12, backgroundColor: colors.line },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, padding: 13, backgroundColor: colors.surface },
  cancelText: { color: colors.chatMine, fontFamily: fonts.sansSemibold, fontSize: 14.5 },
  pressed: { opacity: 0.6 },
}));

// Owner: Account 1. Bottom sheet built on the built-in Modal (no animation library, light on cheap phones).
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { Button } from './Button';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={{ maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg) }}
        >
          {title ? <AppText variant="heading" tone="ink" accessibilityRole="header" style={{ marginBottom: spacing.md }}>{title}</AppText> : null}
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <View style={{ marginTop: spacing.md }}><Button label="Close" variant="ghost" onPress={onClose} fullWidth /></View>
        </View>
      </View>
    </Modal>
  );
}

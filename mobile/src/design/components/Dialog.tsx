// Owner: Account 1. Centered confirmation box.
import { Modal, View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { Button, type ButtonVariant } from './Button';

export interface DialogAction { label: string; onPress: () => void; variant?: ButtonVariant }
export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  actions: DialogAction[];
  /** Called for the Android back button. */
  onRequestClose?: () => void;
}

export function Dialog({ visible, title, message, actions, onRequestClose }: DialogProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.overlay }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.xl }}>
          <AppText variant="heading" tone="ink" accessibilityRole="header">{title}</AppText>
          {message ? <AppText style={{ marginTop: spacing.sm }}>{message}</AppText> : null}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            {actions.map((a) => (
              <Button key={a.label} label={a.label} onPress={a.onPress} variant={a.variant ?? 'secondary'} fullWidth />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

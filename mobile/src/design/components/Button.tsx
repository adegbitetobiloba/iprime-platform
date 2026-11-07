// Owner: Account 1.
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { MIN_TARGET } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, fullWidth, accessibilityHint, testID }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const inactive = Boolean(disabled || loading);
  const look = (pressed: boolean) => {
    switch (variant) {
      case 'primary': return { bg: pressed ? colors.primaryPressed : colors.primary, fg: colors.onPrimary, border: 'transparent' };
      case 'danger': return { bg: pressed ? colors.dangerSoft : colors.surface, fg: colors.danger, border: colors.danger };
      case 'secondary': return { bg: pressed ? colors.tint : colors.surface, fg: colors.link, border: colors.lineStrong };
      default: return { bg: pressed ? colors.tint : 'transparent', fg: colors.link, border: 'transparent' };
    }
  };
  return (
    <Pressable
      testID={testID}
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      style={({ pressed }) => {
        const l = look(pressed);
        return [
          styles.base,
          { minHeight: MIN_TARGET, borderRadius: radius.control, paddingHorizontal: spacing.lg, backgroundColor: l.bg, borderColor: l.border, opacity: disabled ? 0.5 : 1 },
          fullWidth && styles.full,
        ];
      }}
    >
      {({ pressed }) => (
        <View style={styles.row}>
          {loading ? <ActivityIndicator color={look(pressed).fg} style={{ marginRight: spacing.sm }} /> : null}
          <AppText variant="label" style={{ color: look(pressed).fg }}>{label}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

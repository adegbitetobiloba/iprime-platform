// Owner: Account 1. Inline notice with an optional action.
import { View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { Button } from './Button';
import { useToneColors, type Tone } from './Badge';

export interface BannerProps {
  tone?: Tone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function Banner({ tone = 'info', title, message, actionLabel, onAction, testID }: BannerProps) {
  const { radius, spacing } = useTheme();
  const c = useToneColors(tone);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      accessibilityLabel={title ? `${title}. ${message}` : message}
      style={{ backgroundColor: c.bg, borderRadius: radius.control, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: c.fg }}
    >
      {title ? <AppText variant="label" style={{ color: c.fg, marginBottom: spacing.xs }}>{title}</AppText> : null}
      <AppText variant="body" style={{ color: c.fg }}>{message}</AppText>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.md }}><Button label={actionLabel} onPress={onAction} variant="secondary" /></View>
      ) : null}
    </View>
  );
}

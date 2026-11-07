// Owner: Account 1. EmptyState and ErrorState: every list and screen needs both, in plain language.
import { View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { Button } from './Button';

export interface EmptyStateProps { title: string; message?: string; actionLabel?: string; onAction?: () => void }
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <View accessible accessibilityLabel={message ? `${title}. ${message}` : title} style={{ alignItems: 'center', padding: spacing.xl }}>
      <AppText variant="heading" tone="ink" style={{ textAlign: 'center' }}>{title}</AppText>
      {message ? <AppText tone="muted" style={{ textAlign: 'center', marginTop: spacing.sm }}>{message}</AppText> : null}
      {actionLabel && onAction ? <View style={{ marginTop: spacing.lg }}><Button label={actionLabel} onPress={onAction} /></View> : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  /** Plain-language text, for example plainMessage(error) from src/core/errors.ts. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}
export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  const { spacing } = useTheme();
  return (
    <View accessible accessibilityRole="alert" accessibilityLabel={`${title}. ${message}`} style={{ alignItems: 'center', padding: spacing.xl }}>
      <AppText variant="heading" tone="danger" style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText style={{ textAlign: 'center', marginTop: spacing.sm }}>{message}</AppText>
      {onRetry ? <View style={{ marginTop: spacing.lg }}><Button label={retryLabel} onPress={onRetry} /></View> : null}
    </View>
  );
}

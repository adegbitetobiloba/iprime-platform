// Owner: Account 1.
import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { elevation } from '../tokens';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, onPress, accessibilityLabel, accessibilityHint, style, testID }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const base: ViewStyle = { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, ...elevation[1] };
  if (!onPress) return <View testID={testID} style={[base, style]}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.tint }, style]}
    >
      {children}
    </Pressable>
  );
}

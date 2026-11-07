// Owner: Account 1 placeholder; Account 2 builds the real exam screens on top of it.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';

export interface QuestionCardProps {
  number: number;
  total?: number;
  text: string;
  flagged?: boolean;
  /** Usually a list of OptionRow. */
  children?: ReactNode;
}

export function QuestionCard({ number, total, text, flagged, children }: QuestionCardProps) {
  const { spacing } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <AppText variant="label" tone="muted" accessibilityRole="header">{total ? `Question ${number} of ${total}` : `Question ${number}`}</AppText>
        {flagged ? <Badge label="Flagged" tone="warning" /> : null}
      </View>
      <AppText variant="body" tone="ink">{text}</AppText>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>{children}</View>
    </Card>
  );
}

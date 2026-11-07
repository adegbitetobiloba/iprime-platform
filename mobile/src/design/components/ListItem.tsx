// Owner: Account 1.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function ListItem({ title, subtitle, left, right, onPress, showChevron, accessibilityHint, testID }: ListItemProps) {
  const { colors, spacing } = useTheme();
  const body = (
    <>
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={styles.text}>
        <AppText variant="body" tone="ink">{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
      </View>
      {right}
      {showChevron ? <AppText tone="muted" accessibilityElementsHidden importantForAccessibility="no" style={{ marginLeft: spacing.sm }}>›</AppText> : null}
    </>
  );
  const row = { minHeight: 56, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderBottomColor: colors.line };
  if (!onPress) return <View testID={testID} style={[styles.row, row]}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, row, pressed && { backgroundColor: colors.tint }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1 },
});

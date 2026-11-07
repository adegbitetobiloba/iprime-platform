// Owner: Account 1. Selectable option; the touch area is padded to 48dp.
import { Pressable } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

export function Chip({ label, selected, onPress, testID }: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? colors.primary : colors.lineStrong, backgroundColor: selected ? colors.primary : colors.surface }}
    >
      <AppText variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</AppText>
    </Pressable>
  );
}

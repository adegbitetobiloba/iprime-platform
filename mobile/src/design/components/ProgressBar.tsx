// Owner: Account 1.
import { View } from 'react-native';
import { useTheme } from '../theme';

export interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  /** Spoken name, for example "Course progress". */
  label: string;
  testID?: string;
}

export function ProgressBar({ value, label, testID }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}
    >
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  );
}

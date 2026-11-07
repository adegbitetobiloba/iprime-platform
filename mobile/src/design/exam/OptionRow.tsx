// Owner: Account 1 placeholder for Account 2. One answer choice, letters A to F.
import { Pressable, View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import type { OptionLetter } from './format';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';
export interface OptionRowProps {
  letter: OptionLetter;
  label: string;
  state?: OptionState;
  onPress?: () => void;
  testID?: string;
}

export function OptionRow({ letter, label, state = 'idle', onPress, testID }: OptionRowProps) {
  const { colors, radius, spacing } = useTheme();
  const selected = state === 'selected';
  const accent = state === 'correct' ? colors.success : state === 'wrong' ? colors.danger : selected ? colors.primary : colors.lineStrong;
  const fill = state === 'correct' ? colors.successSoft : state === 'wrong' ? colors.dangerSoft : selected ? colors.tint : colors.surface;
  const disabled = state === 'disabled' || !onPress;
  const spoken = state === 'correct' ? ', correct answer' : state === 'wrong' ? ', wrong answer' : '';
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityLabel={`Option ${letter}. ${label}${spoken}`}
      accessibilityState={{ selected, disabled: state === 'disabled' }}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, padding: spacing.md, borderRadius: radius.control, borderWidth: selected || state === 'correct' || state === 'wrong' ? 2 : 1, borderColor: accent, backgroundColor: fill, opacity: state === 'disabled' ? 0.6 : 1 }}
    >
      <View style={{ width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.primary : colors.surface2, marginRight: spacing.md }}>
        <AppText variant="label" style={{ color: selected ? colors.onPrimary : colors.ink }}>{letter}</AppText>
      </View>
      <AppText style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );
}

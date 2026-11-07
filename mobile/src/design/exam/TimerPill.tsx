// Owner: Account 1 placeholder for Account 2. Show time left; compute it from the SERVER deadline (see src/core/clock.ts), never the phone clock alone.
import { View } from 'react-native';
import { AppText } from '../Text';
import { useToneColors, type Tone } from '../components/Badge';
import { useTheme } from '../theme';
import { formatRemaining, spokenRemaining } from './format';

export interface TimerPillProps {
  remainingMs: number;
  warnBelowMs?: number;
  dangerBelowMs?: number;
}

export function TimerPill({ remainingMs, warnBelowMs = 5 * 60_000, dangerBelowMs = 60_000 }: TimerPillProps) {
  const { radius, spacing } = useTheme();
  const tone: Tone = remainingMs <= dangerBelowMs ? 'danger' : remainingMs <= warnBelowMs ? 'warning' : 'info';
  const c = useToneColors(tone);
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Time left: ${spokenRemaining(remainingMs)}`}
      style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', backgroundColor: c.bg, borderColor: c.fg, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg }}
    >
      <AppText variant="label" style={{ color: c.fg, fontVariant: ['tabular-nums'] }}>{formatRemaining(remainingMs)}</AppText>
    </View>
  );
}

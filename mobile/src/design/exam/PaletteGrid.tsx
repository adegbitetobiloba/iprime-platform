// Owner: Account 1 placeholder for Account 2. Question navigator; plain View grid is fine up to a few hundred questions.
import { Pressable, View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { MIN_TARGET } from '../tokens';

export interface PaletteGridProps {
  total: number;
  /** 1-based number of the question on screen. */
  current: number;
  answered: number[];
  flagged?: number[];
  onSelect: (questionNumber: number) => void;
}

export function PaletteGrid({ total, current, answered, flagged = [], onSelect }: PaletteGridProps) {
  const { colors, radius, spacing } = useTheme();
  const done = new Set(answered);
  const flags = new Set(flagged);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isDone = done.has(n);
        const isFlag = flags.has(n);
        const status = `${isDone ? 'answered' : 'not answered'}${isFlag ? ', flagged' : ''}${isCurrent ? ', current' : ''}`;
        return (
          <Pressable
            key={n}
            onPress={() => onSelect(n)}
            accessibilityRole="button"
            accessibilityLabel={`Question ${n}, ${status}`}
            style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: isCurrent ? 3 : isFlag ? 2 : 1, borderColor: isCurrent ? colors.ink : isFlag ? colors.goldText : colors.lineStrong, backgroundColor: isDone ? colors.primary : colors.surface }}
          >
            <AppText variant="label" style={{ color: isDone ? colors.onPrimary : colors.text }}>{n}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

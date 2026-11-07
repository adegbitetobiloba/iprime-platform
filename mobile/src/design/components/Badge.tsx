// Owner: Account 1. Small status label (not tappable).
import { View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'gold';

/** Background and text colours for a tone. Shared by Badge, Banner and the exam pills. */
export function useToneColors(tone: Tone): { bg: string; fg: string } {
  const { colors } = useTheme();
  switch (tone) {
    case 'info': return { bg: colors.infoSoft, fg: colors.info };
    case 'success': return { bg: colors.successSoft, fg: colors.success };
    case 'danger': return { bg: colors.dangerSoft, fg: colors.danger };
    case 'warning': return { bg: colors.goldSoft, fg: colors.goldText };
    case 'gold': return { bg: colors.gold, fg: colors.onGold };
    default: return { bg: colors.surface2, fg: colors.muted };
  }
}

export function Badge({ label, tone = 'neutral', testID }: { label: string; tone?: Tone; testID?: string }) {
  const { radius, spacing } = useTheme();
  const c = useToneColors(tone);
  return (
    <View testID={testID} accessible accessibilityLabel={label} style={{ alignSelf: 'flex-start', backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 2 }}>
      <AppText variant="caption" style={{ color: c.fg }}>{label}</AppText>
    </View>
  );
}

// Owner: Account 1 placeholder for Account 2. Tells the student their answers are safe.
import { View } from 'react-native';
import { AppText } from '../Text';
import { useToneColors, type Tone } from '../components/Badge';
import { useTheme } from '../theme';

export type AutosaveStatus = 'saved' | 'saving' | 'offline' | 'error';
const LABEL: Record<AutosaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline: saved on this phone',
  error: 'Could not save. Retrying',
};
const TONE: Record<AutosaveStatus, Tone> = { saved: 'success', saving: 'neutral', offline: 'warning', error: 'danger' };

export function AutosavePill({ status }: { status: AutosaveStatus }) {
  const { radius, spacing } = useTheme();
  const c = useToneColors(TONE[status]);
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={LABEL[status]}
      style={{ alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center', backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: spacing.md }}
    >
      <AppText variant="caption" style={{ color: c.fg }}>{LABEL[status]}</AppText>
    </View>
  );
}

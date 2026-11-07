// Owner: Account 1. Friendly "waking the server" view. M1a shows this full-screen before login; the demo shows it inside a card.
import { View } from 'react-native';
import { AppText, Banner, Button, ErrorState, ProgressBar, useTheme } from '@/design';
import type { WakeState } from '@/core/wake';

const secs = (ms: number) => Math.round(ms / 1000);

export function WakeStatus({ state, onRetry }: { state: WakeState; onRetry: () => void }) {
  const { spacing } = useTheme();
  switch (state.phase) {
    case 'idle':
      return <AppText tone="muted">Not checked yet.</AppText>;
    case 'checking':
      return <AppText accessibilityLiveRegion="polite">Checking the server…</AppText>;
    case 'waking':
      return (
        <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
          <AppText variant="heading" tone="ink">Waking up the server…</AppText>
          <AppText tone="muted">The server sleeps when nobody is using it. It usually wakes in under a minute. Please keep the app open.</AppText>
          <ProgressBar label="Waking the server" value={Math.min(0.95, state.elapsedMs / 60_000)} />
          <AppText variant="caption" tone="muted">{secs(state.elapsedMs)} seconds so far</AppText>
        </View>
      );
    case 'ready':
      return (
        <Banner
          tone="success"
          title="Server is ready"
          message={state.woke ? `It was asleep and woke up in about ${secs(state.elapsedMs)} seconds.` : `It answered straight away (${(state.elapsedMs / 1000).toFixed(1)} seconds).`}
        />
      );
    case 'failed':
      return (
        <ErrorState
          title={state.reason === 'offline' ? "You're offline" : state.reason === 'aborted' ? 'Check cancelled' : "The server didn't wake up"}
          message={
            state.reason === 'offline'
              ? 'Turn on mobile data or Wi-Fi, then try again.'
              : state.reason === 'aborted'
                ? 'You can start the check again.'
                : 'It is taking longer than usual. Please try again in a minute.'
          }
          onRetry={onRetry}
        />
      );
  }
}

/** Full-screen version used before sign-in (M1a). */
export function WakeScreen({ state, onRetry }: { state: WakeState; onRetry: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg }}>
      <AppText variant="display" tone="ink" style={{ marginBottom: spacing.xl }}>iPrime</AppText>
      <WakeStatus state={state} onRetry={onRetry} />
      {state.phase === 'idle' ? <Button label="Check server" onPress={onRetry} /> : null}
    </View>
  );
}

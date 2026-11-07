// Owner: Account 1. Showcase of the theme, every component, and the wake-up probe against the real /health.
// Replaced by the sign-in gate in M1a. Nothing here sends a token, registers, or logs in.
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getConfig } from '@/core/config';
import { plainMessage, ApiError } from '@/core/errors';
import { useWakeProbe } from '@/core/useWakeProbe';
import {
  AppText, AutosavePill, Badge, Banner, Button, Card, Chip, Dialog, EmptyState, ErrorState, Input, ListItem, OfflineBanner, OptionRow,
  OtpInput, PaletteGrid, ProgressBar, QuestionCard, Sheet, Skeleton, TimerPill, textSizeLabels, useTheme, useToast,
  type TextSize, type ThemeMode,
} from '@/design';
import { WakeStatus } from './WakeScreen';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl, gap: spacing.md }}>
      <AppText variant="heading" tone="ink" accessibilityRole="header">{title}</AppText>
      {children}
    </View>
  );
}

export function DemoScreen() {
  const { colors, spacing, mode, setMode, textSize, setTextSize } = useTheme();
  const toast = useToast();
  const wake = useWakeProbe();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [otp, setOtp] = useState('');
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [choice, setChoice] = useState<'A' | 'B' | 'C' | 'D' | null>('B');
  const [current, setCurrent] = useState(3);
  let origin = '(not set)';
  let envName = '';
  let configError: string | null = null;
  try { const c = getConfig(); origin = c.origin; envName = c.env; } catch (e) { configError = e instanceof Error ? e.message : String(e); }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* The F4 shell will show this on every screen; for now the demo hosts it. Turn on airplane mode to see it. */}
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <AppText variant="display" tone="ink">iPrime</AppText>
        <AppText tone="muted" style={{ marginBottom: spacing.xl }}>Foundation demo (F1 and F2). Nothing here signs you in.</AppText>

        <Section title="Server wake-up check">
          {configError ? (
            <Banner tone="danger" title="Setup needed" message={configError} />
          ) : (
            <>
              <AppText variant="caption" tone="muted">Checks {origin}/health ({envName}). No sign-in, no data sent.</AppText>
              <WakeStatus state={wake.state} onRetry={wake.start} />
              <Button label={wake.state.phase === 'idle' ? 'Check the server' : 'Check again'} onPress={wake.start} />
            </>
          )}
        </Section>

        <Section title="Theme and text size">
          <AppText variant="label" tone="muted">Theme</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <Chip key={m} label={m === 'system' ? 'Phone setting' : m === 'light' ? 'Light' : 'Dark'} selected={mode === m} onPress={() => setMode(m)} />
            ))}
          </View>
          <AppText variant="label" tone="muted">Text size</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(Object.keys(textSizeLabels) as TextSize[]).map((s) => (
              <Chip key={s} label={textSizeLabels[s]} selected={textSize === s} onPress={() => setTextSize(s)} />
            ))}
          </View>
          <AppText>This sentence grows and shrinks with your text size.</AppText>
        </Section>

        <Section title="Type">
          <AppText variant="display" tone="ink">Display, Fraunces</AppText>
          <AppText variant="title" tone="ink">Title</AppText>
          <AppText variant="heading" tone="ink">Heading</AppText>
          <AppText>Body text in Plus Jakarta Sans.</AppText>
          <AppText variant="label" tone="muted">Label</AppText>
          <AppText variant="caption" tone="muted">Caption</AppText>
        </Section>

        <Section title="Buttons">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label="Primary" onPress={() => toast.show({ message: 'Primary pressed', tone: 'info' })} />
            <Button label="Secondary" variant="secondary" onPress={() => undefined} />
            <Button label="Ghost" variant="ghost" onPress={() => undefined} />
            <Button label="Danger" variant="danger" onPress={() => undefined} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label="Loading" loading onPress={() => undefined} />
            <Button label="Disabled" disabled onPress={() => undefined} />
          </View>
        </Section>

        <Section title="Inputs">
          <Input label="First name" value={name} onChangeText={setName} placeholder="For example Ada" helper="As it appears on your registration." autoComplete="given-name" />
          <Input label="Password" value={pw} onChangeText={setPw} secureTextEntry error={pw && pw.length < 8 ? 'Use at least 8 characters.' : undefined} autoCapitalize="none" />
          <AppText variant="label" tone="muted">Verification code</AppText>
          <OtpInput value={otp} onChange={setOtp} />
        </Section>

        <Section title="Cards, lists, badges, progress">
          <Card><AppText variant="heading" tone="ink">Mathematics</AppText><AppText tone="muted">12 of 30 lessons done</AppText><View style={{ marginTop: spacing.md }}><ProgressBar label="Course progress" value={0.4} /></View></Card>
          <Card onPress={() => toast.show({ message: 'Card opened', tone: 'success' })} accessibilityLabel="English course card"><AppText variant="heading" tone="ink">Tap this card</AppText></Card>
          <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
            <ListItem title="JAMB Practice 1" subtitle="40 questions · 30 minutes" showChevron onPress={() => undefined} right={<Badge label="Open" tone="success" />} />
            <ListItem title="WAEC Mock" subtitle="Opens Monday" right={<Badge label="Soon" tone="neutral" />} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Badge label="Info" tone="info" /><Badge label="Success" tone="success" /><Badge label="Warning" tone="warning" /><Badge label="Danger" tone="danger" /><Badge label="Gold" tone="gold" />
          </View>
        </Section>

        <Section title="Banners and states">
          <Banner tone="info" title="Tip" message="Your answers are saved as you go." />
          <Banner tone="warning" title="Almost done" message="You have 5 minutes left." actionLabel="Review answers" onAction={() => undefined} />
          <Banner tone="danger" title="Not saved" message="We could not reach the server." />
          <Skeleton height={20} /><Skeleton height={20} width="60%" />
          <EmptyState title="No exams yet" message="New exams will show up here." actionLabel="Refresh" onAction={() => undefined} />
          <ErrorState message={plainMessage(new ApiError({ status: 0, code: 'NETWORK', message: 'x' }))} onRetry={() => undefined} />
        </Section>

        <Section title="Sheet, dialog, toast">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label="Open sheet" variant="secondary" onPress={() => setSheet(true)} />
            <Button label="Open dialog" variant="secondary" onPress={() => setDialog(true)} />
            <Button label="Show toast" variant="secondary" onPress={() => toast.show({ message: 'Saved', tone: 'success' })} />
          </View>
        </Section>

        <Section title="Exam pieces (placeholders for Account 2)">
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <TimerPill remainingMs={25 * 60_000} /><TimerPill remainingMs={4 * 60_000} /><TimerPill remainingMs={45_000} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <AutosavePill status="saved" /><AutosavePill status="saving" /><AutosavePill status="offline" /><AutosavePill status="error" />
          </View>
          <QuestionCard number={current} total={20} text="Which of these is a prime number?" flagged={current === 5}>
            {(['A', 'B', 'C', 'D'] as const).map((l, i) => (
              <OptionRow key={l} letter={l} label={['4', '9', '11', '15'][i]!} state={choice === l ? 'selected' : 'idle'} onPress={() => setChoice(l)} />
            ))}
          </QuestionCard>
          <PaletteGrid total={20} current={current} answered={[1, 2, 3, 4]} flagged={[5]} onSelect={setCurrent} />
        </Section>
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filter exams">
        <AppText>Sheets hold filters, pickers and short forms.</AppText>
      </Sheet>
      <Dialog
        visible={dialog}
        title="Submit your exam?"
        message="You have 3 unanswered questions."
        onRequestClose={() => setDialog(false)}
        actions={[{ label: 'Keep working', onPress: () => setDialog(false), variant: 'primary' }, { label: 'Submit now', onPress: () => setDialog(false), variant: 'danger' }]}
      />
    </SafeAreaView>
  );
}

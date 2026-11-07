# iPrime Mobile design system (F1)

Owner: Account 1. Import everything from `@/design`. Never hard-code a colour, size or font in a screen.
Brand values are copied from `frontend/src/tokens.css` ("Summit"). Success and danger colours are not in the website tokens: Account 1 added them.

## Colours
| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #F7F9FD | #0A1224 | page |
| surface | #FFFFFF | #131E3A | cards, inputs |
| ink | #0B1F4B | #E8EEFF | headings |
| text | #1B2640 | #E6ECFB | body |
| muted | #465273 | #A9B6D3 | secondary text |
| primary / primaryPressed | #1F5FE0 / #1748B8 | same | buttons (white text) |
| link | #1F5FE0 | #8DB4FF | blue used as text |
| gold / onGold | #F2B33D / #0B1F4B | same | decoration only; text on gold is always navy |
| goldSoft / goldText | #FDF1D6 / #7A4F00 | #2B2616 / #F2B33D | warnings |
| success, danger, info (+Soft) | see `tokens.ts` | | status |

Shape: card radius 20, control radius 12, pill 999. Spacing: 4, 8, 12, 16, 24, 32. Minimum touch target: 48dp.

## Fonts and text size
Plus Jakarta Sans for everything; Fraunces only for the `display` variant (big headlines). If the fonts fail to load within 4 seconds the app uses the system font.
Variants: display 32, title 24, heading 18, body 16, label 14, caption 12 (dp, before scaling).
Text size setting (Settings later, Chips in the demo): Small 0.9, Default 1, Large 1.15, Extra large 1.3. The phone's own font scale also applies, capped at 1.5 so layouts do not break.
Use `<AppText variant="body" tone="muted">`. Do not use React Native's `Text` directly.

## Themes
`ThemeProvider` (already in `src/core/providers.tsx`) offers Phone setting / Light / Dark and remembers the choice. In a component: `const { colors, spacing, radius, isDark } = useTheme();`

## Contrast (measured with a script, WCAG)
Text pairs all reach 4.5:1 and control borders 3:1 in both themes (enforced by `tokens.test.ts`). Examples: text on page 14.25 (light) / 15.78 (dark); muted on page 7.34 / 9.17; white on blue 5.57; navy on gold 8.61.
These match the figures in the website's own `tokens.css` comment.

## Components
All take plain props, show loading/disabled/error where relevant, set accessibility roles and labels, and are at least 48dp to tap (Chip is 36dp visible with padded touch area).

```tsx
import { Button, Input, OtpInput, Card, ListItem, Badge, Chip, ProgressBar, Banner, Sheet, Dialog,
         useToast, Skeleton, EmptyState, ErrorState, OfflineBanner } from '@/design';

<Button label="Sign in" onPress={submit} loading={busy} fullWidth />            // variants: primary secondary ghost danger
<Input label="Email" value={email} onChangeText={setEmail} error={emailError} autoCapitalize="none" />
<Input label="Password" value={pw} onChangeText={setPw} secureTextEntry />       // Show/Hide button included
<OtpInput value={code} onChange={setCode} length={6} onComplete={verify} />     // paste and SMS autofill work
<Card onPress={open} accessibilityLabel="Mathematics course"><AppText>...</AppText></Card>
<ListItem title="JAMB Practice 1" subtitle="40 questions" showChevron onPress={open} right={<Badge label="Open" tone="success" />} />
<Chip label="Large" selected={on} onPress={choose} />
<ProgressBar label="Course progress" value={0.4} />
<Banner tone="warning" title="Almost done" message="5 minutes left." actionLabel="Review" onAction={review} />
<Sheet visible={open} onClose={close} title="Filter">...</Sheet>
<Dialog visible={ask} title="Submit?" actions={[{ label: 'Keep working', onPress: back, variant: 'primary' }]} />
const toast = useToast(); toast.show({ message: 'Saved', tone: 'success' });
<Skeleton height={20} />   <EmptyState title="No exams yet" />   <ErrorState message={plainMessage(error)} onRetry={refetch} />
<OfflineBanner />          // shows only while offline
```
Tones: neutral, info, success, warning, danger, gold.

## Exam pieces (placeholders for Account 2)
`QuestionCard`, `OptionRow` (letters A to F; states idle, selected, correct, wrong, disabled), `PaletteGrid`, `TimerPill`, `AutosavePill`, plus `formatRemaining` and `spokenRemaining`. They look right and are accessible, but contain no exam logic. Account 2 may extend them through a Request.
For time, always compute `serverClock.remainingMs(attempt.deadline)` (`@/core/clock`), never the phone clock alone.

## Motion
Durations 120, 200 and 320 ms, used sparingly. Skeletons pulse and toasts fade only when the phone does not ask for reduced motion.

## Accessibility rules every screen follows
Roles and labels on every tappable thing; 48dp targets; errors announced politely; text scales; no colour-only meaning (status badges carry words); light and dark both pass contrast.

## Not done yet
Icons (no icon library chosen), on-device screen-reader testing (no TalkBack run yet), Settings screen (F4).

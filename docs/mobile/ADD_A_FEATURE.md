# How to add a feature module (target: under an hour)

Owner: Account 1. Applies to Accounts 2 to 7. Note: the tab bar and its slots arrive in phase F4. Until then a new screen is a plain route.

## 1. Make your folder
```
mobile/src/features/<name>/        e.g. exam, library (the folders already exist with an OWNERS.md)
  api.ts        typed calls using getApi()
  hooks.ts      React Query hooks
  screens/      screen bodies (components)
```
Only edit your own folder. Do not edit `src/core`, `src/design` or `src/shell`: send a Request (template C).

## 2. Add a route
A route file only renders a screen. Routes live in `mobile/src/app/`.
```tsx
// mobile/src/app/<name>/index.tsx
import { MyScreen } from '@/features/<name>/screens/my-screen';
export default function Route() { return <MyScreen />; }
```
Open it on a device with the link `iprime://<name>`. Account 1 adds it to the tab bar in F4.

## 3. Call the API
```ts
// api.ts
import { getApi } from '@/core/api';
export const listExams = (signal?: AbortSignal) => getApi().get<{ exams: Exam[] }>('/exams', { signal });
```
- Paths start after `/api` (the client adds it). The token is added for you.
- Errors are `ApiError` with `.code` and `.status`; show `plainMessage(error)`, never `error.message`.
- GET requests retry by themselves. For a POST or PUT that is safe to repeat (answer save, submit) pass `{ idempotent: true }`.
- Public calls (login, OTP, Google): pass `{ auth: false }`.
- 401 and the approval codes sign the user out for you. Do not handle them in your screens.
- Time: `serverClock.remainingMs(deadline)` from `@/core/clock`. It learns `serverNow` from every reply.

## 4. Use React Query
```tsx
// hooks.ts
import { useQuery } from '@tanstack/react-query';
export const useExams = () => useQuery({ queryKey: ['exams'], queryFn: ({ signal }) => listExams(signal) });
```
```tsx
// a screen
const q = useExams();
if (q.isPending) return <Skeleton height={20} />;
if (q.isError) return <ErrorState message={plainMessage(q.error)} onRetry={q.refetch} />;
if (!q.data.exams.length) return <EmptyState title="No exams yet" />;
```
Every screen must have loading, empty, error and offline states (`OfflineBanner` is global in F4).

## 5. Style with the design system
Import from `@/design`. No hard-coded colours, sizes or fonts. See `DESIGN_SYSTEM.md`.

## 6. Test and check
Put tests next to the code (`thing.test.ts`). Inject `fetch`, time and sleep rather than faking timers (see `src/core/http.test.ts`).
```
cd mobile && npm run typecheck && npm run lint && npm test
```
Paste the exact output in your report. Say "tested" only for what you ran.

## 7. Checklist
- [ ] Only my folder and my route files changed
- [ ] Loading, empty, error, offline states
- [ ] `plainMessage()` for errors
- [ ] Touch targets 48dp, labels set, works in dark mode and at Extra large text
- [ ] No tokens, passwords or personal data in logs
- [ ] typecheck, lint and tests pass, output pasted

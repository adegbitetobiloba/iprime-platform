# ADR-001: Mobile stack

Status: proposed by Account 1, awaiting owner approval. Date: 2026-11-06.

## Decision
React Native with Expo (current stable SDK at build time), TypeScript strict, Expo Router, TanStack Query,
`expo-secure-store` for the session token, EAS cloud builds. Development builds (not Expo Go) once native
modules such as Google sign-in are added. New code lives in `mobile/` in the existing repo.

## Why
- The team already runs a JavaScript/React stack (Express backend, React web). One language, shared knowledge.
- EAS builds APKs in the cloud, so no local Android toolchain is needed (the owner works from a phone or Codespaces).
- The existing backend is reused unchanged for M1a and M1b (see CONTRACTS v1.1/v1.2).
- Native screens (not a web view) avoid the "thin wrapper" store-rejection risk.

## Alternatives considered
| Option | Why not (for now) |
|---|---|
| Bare React Native | More native setup and upgrade work for no gain we need today. |
| Flutter | Good performance, but a new language and no knowledge shared with the web app. |
| Native Kotlin/Swift | Two codebases; far too slow for a small team. |
| PWA / Capacitor wrapper | Store "thin wrapper" risk and weaker control for ExamGuard. |

## Consequences
- Expo Go cannot run native Google sign-in; use development builds or preview APKs.
- The SDK version is chosen by `create-expo-app` at bootstrap and recorded in `mobile/package.json`. Moving SDKs later is its own task.
- iOS builds need a paid Apple Developer account; until then code is written for both and tested on Android.
- Unverified: performance on 2 to 3 GB RAM phones (Account 8 measures), EAS free-tier queue times.

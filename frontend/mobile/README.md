# So Life mobile

React Native client for the productivity app, built with Expo SDK 57 and Expo Router. It shares the Spring Boot API and Keycloak realm with the web frontend.

## What is included

- Keycloak authorization-code login with PKCE, encrypted refresh-token storage, token refresh, and logout
- Today dashboard, day rating, task creation/editing/completion, and 25-minute focus starts
- Task, calendar event, mental thread, mental-state, meditation, note, and stat workflows
- Shared Raleway typography, web palette, four accent colors, light/dark/system themes, soft cards, and task-priority colors
- Durable notification recovery from the backend, presented through native notifications when permission is available

## First-time setup

Use Node 22.13 or newer, then install dependencies:

```bash
cd frontend/mobile
npm install
```

In Keycloak, add `solife://auth` to the `productivity-app-frontend` client's valid redirect URIs. Keep the client public with standard flow and PKCE enabled. No client secret belongs in the app.

Start the backend, PostgreSQL, and Keycloak from the repository root:

```bash
./run-app.sh
```

The local Keycloak container publishes `http://localhost:7070` as its issuer. Android therefore needs reverse port forwarding so the device's loopback addresses reach the development machine while preserving the issuer exactly:

```bash
adb reverse tcp:7070 tcp:7070
adb reverse tcp:8080 tcp:8080
```

Then build and run the native app:

```bash
cd frontend/mobile
npm run android
```

OAuth requires the app's custom `solife` scheme, so use a development/native build rather than Expo Go. An iOS simulator can use the loopback defaults directly; building iOS requires macOS. Physical iOS devices should point `.env.local` at deployed HTTPS API and Keycloak URLs.

For a deployed environment, copy `.env.example` to `.env.local` and replace both service URLs with their public HTTPS origins. The Keycloak URL must match the issuer configured on the backend.

## Validation

```bash
npm run lint
npm run typecheck
npm run export:android
```

## Structure

- `src/app/` — protected routes, bottom tabs, and feature screens
- `src/components/` — native design-system and feature components
- `src/providers/` — Keycloak session, theme, and notifications
- `src/services/api.ts` — typed authenticated API client shared by every screen
- `src/types/models.ts` — frontend view of backend contracts

## Current mobile-specific limits

- Calendar uses a touch-friendly upcoming agenda instead of FullCalendar's desktop month grid.
- Notes use a plain-text editor. Existing rich HTML is readable as text, but saving it from mobile simplifies that formatting.
- Pomodoro starts and durable notification recovery work, but the mobile client does not yet expose the web client's complete phase-control panel or STOMP socket; it recovers notifications by polling on launch, foreground, and once per minute.
- Meditation interval-bell audio and the web client's sound choices are not bundled yet. Session state and timing still persist through the backend.
- Notes remain dependent on the planned notes backend, just like the current web Notes page.

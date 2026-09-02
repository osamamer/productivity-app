# Mobile frontend

This directory contains the Expo/React Native client. Keep it API-compatible with the authenticated web client and use `EXPO_PUBLIC_*` variables for public origins and client identifiers only; never place a Keycloak client secret in the bundle.

Use `src/providers/ThemeProvider.tsx` as the source of visual tokens, `src/services/api.ts` for backend calls, and `src/types/models.ts` for transport shapes. New protected screens belong under `src/app/` and must be declared inside the authenticated `Stack.Protected` group in `src/app/_layout.tsx`.

Use `src/providers/PopupProvider.tsx` and `src/components/ui/AppPopup.tsx` for confirmations, errors, and reminder fallbacks; do not use React Native system alerts. Date and time fields should keep their selection UI inside the themed popup. Task priority presentation is shared through `src/lib/taskPriority.ts` so mobile uses the web client’s Low/Medium/High colors and thresholds.

Run `npm run lint`, `npm run typecheck`, and `npm run export:android` before handing off mobile changes. OAuth must be tested in a native development build because Expo Go cannot register the `solife` callback scheme.

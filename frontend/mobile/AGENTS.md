# Mobile frontend

This directory contains the Expo/React Native client. Keep it API-compatible with the authenticated web client and use `EXPO_PUBLIC_*` variables for public origins and client identifiers only; never place a Keycloak client secret in the bundle.

Use `src/providers/ThemeProvider.tsx` as the source of visual tokens, `src/services/api.ts` for backend calls, and `src/types/models.ts` for transport shapes. New protected screens belong under `src/app/` and must be declared inside the authenticated `Stack.Protected` group in `src/app/_layout.tsx`. `Screen` provides the subtle page-entry animation; keep page transitions restrained so they do not add loading flashes.

Use `src/providers/PopupProvider.tsx` and `src/components/ui/AppPopup.tsx` for confirmations, errors, and reminder fallbacks; do not use React Native system alerts. Date and time fields should keep their selection UI inside the themed popup. Task priority controls use `src/lib/taskPriority.ts` for the web client’s Low/Medium/High colors and thresholds. Calendar task items stay neutral and show their assigned calendar color only on the left edge.

`src/lib/taskDetailsCache.ts` owns the in-memory task details cache, including subtasks and recurrence. Prefetch task rows and visible calendar items with its four-request concurrency limit, update cached details through the API service, and clear the cache when the authenticated session ends.

For mobile scheduling controls, use a `Custom` action that opens the themed date/time popup. Do not leave a `Someday` action that silently means “no date”; keep custom selection and cancellation behavior explicit.

Run `npm run lint`, `npm run typecheck`, and `npm run export:android` before handing off mobile changes. OAuth must be tested in a native development build because Expo Go cannot register the `solife` callback scheme.

# Regression testing

The standalone `Regression` GitHub Actions workflow runs on every push and can also be started manually. Its backend, web, and mobile jobs are independent of the `Verify and deploy` workflow; the regression results do not gate its build or deployment jobs.

Run the client regression suites locally:

```bash
cd frontend/react && npm run test:regression
cd frontend/mobile && npm run test:regression
```

Run the focused backend suite locally:

```bash
cd backend && ./mvnw -B -ntp -Dtest=EndToEndTest,TaskProjectAssignmentTest,MentalStateServiceTest,CalendarEventServiceTest,NotificationServiceRepeatTest test
```

## Covered cases

- **Backend task and focus flow** (`EndToEndTest`): task creation, session start/end, pause/unpause, and rejection of invalid session transitions.
- **Backend projects and task assignments** (`TaskProjectAssignmentTest`): project ownership, unknown or foreign project rejection, assignment creation/removal, omitted versus explicit-null updates, and project task filtering.
- **Backend mental state** (`MentalStateServiceTest`): ordered state classification, matching suggested actions, rating validation, multiple check-ins per day, user-scoped history, and owned deletion.
- **Backend calendar and reminders** (`CalendarEventServiceTest`): default/disabled reminders, event time zones, invalid time ranges, recurrence validation, and per-occurrence cancellation, status, movement, deletion, and reminder rescheduling.
- **Backend durable notifications** (`NotificationServiceRepeatTest`): supported push delivery, acknowledgement, check-up repetition, preference and recent-check-in suppression, and delivery without a WebSocket identity.
- **Web task dates** (`task-date.test.mjs`): backend local date-time strings retain their calendar date, explicitly zoned timestamps resolve to the browser's local date, and invalid values produce no date key.
- **Web appearance preferences** (`preferences.test.mjs`): a delayed save to one setting cannot roll back a newer theme-mode or accent choice, and failed latest changes return to the saved preference.
- **Web optimistic Pomodoro** (`optimistic-pomodoro.test.mjs`): minute/second conversion, initial state, pause/resume, waiting-phase transitions, short and long break durations, elapsed focus accounting, invalid action rejection, and completion accounting.
- **Web calendar recurrence** (`calendar-recurrence.test.mjs`): inclusive weekly end dates, canceled and deleted occurrences, moving an occurrence into the visible range while preserving its identity, monthly month-end clamping, and inclusive all-day dates. The test loads the production helper through Vite's SSR transformer.
- **Web cache and loading behavior** (`cache.test.mjs`): TTL boundaries, stale reads, LRU eviction, invalid cache settings, in-flight request deduplication, and protection from stale responses after invalidation, explicit writes, or cache clearing.
- **Web stat values** (`stat-values.test.mjs`): sleep/wake display scales, overnight threshold comparisons and averages, valid/invalid time and duration fields, rounding, and midnight formatting.
- **Web resource updates** (`resource-invalidation.test.mjs`): resource-specific notifications and unsubscribe behavior.
- **Mobile task priority** (`task-priority.test.mjs`): low/medium/high boundary thresholds and consistent editor value/color mapping.
- **Mobile calendar recurrence** (`calendar-recurrence.test.mjs`): weekly and custom two-week expansion, timezone-equivalent occurrence keys, cancellation, moved/deleted occurrences, recurrence end dates, and inclusive all-day coverage.
- **Mobile date and timer formatting** (`date.test.mjs`): local date serialization, event date/time-zone conversion across midnight, date validation, greeting boundaries, backend duration parsing, and timer clock formatting.
- **Mobile stat values** (`stat-values.test.mjs`): web/mobile agreement for time scales, overnight averages, input validation, duration conversion, and display formatting.
- **Mobile user-facing errors** (`errors.test.mjs`): concise sign-in mappings, generic fallback behavior, provider detail suppression, and developer-side error logging.
- **Mobile resource updates** (`resource-invalidation.test.mjs`): resource-specific notifications and unsubscribe behavior.
- **Mobile background audio** (`audio-mode.test.mjs`): silent-mode/background playback settings, interruption mode, and safe handling when native configuration is unavailable or fails.

The client suites use Node's built-in test runner. Web recurrence tests use Vite's SSR transformer, so the web job installs its existing npm dependencies; other cases import production TypeScript helpers directly. They need Node 22 but do not launch a browser or emulator, or start backend services.

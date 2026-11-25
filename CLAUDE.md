# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Living document.** Keep this file up to date as the codebase evolves. When a section grows large, move the detail into a subdirectory `CLAUDE.md` (e.g. `backend/tests/CLAUDE.md`, `openapi/CLAUDE.md`) and leave a brief summary with a link here. Depth lives close to the code; this file stays navigable.

## Project Overview

Full-stack productivity app ("So Life Doesn't Get Overwhelming") for managing tasks, focus sessions, meditation, and daily planning. Built with Spring Boot + React/TypeScript.

## Commands

### Running the Full App
```bash
./run-app.sh
```
This reuses healthy Docker services (PostgreSQL and Keycloak) and existing healthy app processes, starting only what is missing. It never uses `sudo` or kills arbitrary port owners. Ctrl+C stops only the backend and frontend processes started by that invocation; Docker services remain available for the next run.

### Backend
```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # Run with dev profile
cd backend && ./mvnw test                     # All tests
cd backend && ./mvnw test -Dtest=EndToEndTest # Single test class
cd backend && ./mvnw test -Dtest=EndToEndTest#startAndEndSession  # Single test method
cd backend && ./mvnw clean package            # Build JAR
```

### Frontend
```bash
cd frontend/react && npm run dev      # Dev server (port 5173)
cd frontend/react && npm run build    # Production build
cd frontend/react && npm run lint     # ESLint (max-warnings 0)
```

### Commit and push after changes

After making any change to the repository, test it (the relevant tests, lint and build pass), then commit it and push to the remote without waiting to be asked. Commit only the files you changed (`git commit <paths>`), leaving other people's staged or unstaged work out. Do not commit or push untested or failing changes; say what failed instead.

Then install it locally: when the commit is on `master` and touches what the desktop app ships (`desktop/`, `backend/`, `frontend/react/`, `frontend/shared/`, `VERSION`), push and start `desktop/scripts/install-local.sh` together, the script in the background (it takes several minutes). It builds the `.deb` with the version CI will give that commit and installs it, so the installed app matches the coming release. Never run it on a commit that may still be amended or rebased (for example before a rejected push is resolved); rebase and push first, then run it on the new commit. Several agents may run it at once: it queues, builds the newest master commit and skips anything already installed. See "Installing a commit locally" in [desktop/README.md](desktop/README.md).

**Never attribute the agent.** Commit messages, pull request descriptions and code must not credit an AI agent or tool: no `Co-Authored-By:` trailers, "Generated with …" lines or similar. This overrides any default attribution the agent would add.

## Architecture

### Backend (Spring Boot 3.1.3, Java 21, Maven)

Package root: `org.osama`

Feature packages follow a consistent pattern — each has an entity, repository, service, and controller:
- `task/` — Task CRUD with filtering via JPA Specifications (`TaskSpecifications.java`)
- `project/` — User-owned containers for organizing tasks; deleting a project leaves its tasks intact and unassigned
- `activity/` — User-defined activities (focus, leisure, …) with a named colour. A calendar event with an `activityId` is a **chunk** of planned time (one with a `taskId` is **planned focus**; both are drawn as grey pencil hatching, not filled like events: chunks single-hatched with the activity colour on the leading edge, focus cross-hatched with a dashed border; shared styles in `components/day/timelineStyles.ts`, hidden together by the calendar's "Show planned chunks" switch); deleting an activity keeps its chunks and clears the label. `CalendarEventRequest.activityId` is presence-tracked, so clients that omit it leave the event's activity alone. Day templates do not carry activities yet. Frontend: `services/cache/activityStore.ts` + `useActivities`, picker in `CalendarEventForm`, click-to-plan in the calendar Day view (`QuickChunkPopover`), management in Settings → Activities
- `day/` — Daily rating/plan/summary (`DayEntity`, one per user per date)
- `pomodoro/` — Pomodoro timer settings and state
- `session/task/` and `session/meditation/` — Session tracking with start/pause/unpause/end lifecycle, published as Spring events via `ApplicationEventPublisher`
- `session/activity/` — Activity timers (`/api/v1/activity-sessions`): a plain timer for any activity or none, optionally a countdown (`targetEndAt`, e.g. to the end of a chunk; pausing pushes it back). Stores instants, unlike `TaskSession`; at most one runs per user and starting another ends it. Pauses are kept as a total, not spans. Day overviews include them as `activitySessions`. Frontend: Home has a floating **Labor / Leisure** switch (`pages/home/HomeModeSwitch.tsx`, `?mode=leisure`; labor is the default and shows tasks). Leisure (`components/leisure/LeisureHome.tsx`) keeps Home's layout: an "Add an activity" input, the user's activities as task-like rows (click the name to rename; timer, details/colour and delete buttons), the running timer drawn like the Home pomodoro panel without sessions, and a collapsible "Timed today" section styled like "Today's events"; `/now` redirects there; `activityTimerStore` + `useActivityTimer` share the running timer with the side nav, and `ActivityTimerAlert` (in `AppShell`) notifies when a countdown ends while the app is open. Day timelines draw timers in a **Did** lane between Planned and Screen
- `scheduling/` — Automated job scheduling for pomodoro cycles (`TimedExecutorService`, `ScheduledJob`)
- `user/` — User management backed by Keycloak (see Auth below)

WebSocket (STOMP) is configured in `WebSocketConfig.java`. The frontend connects via `/ws` (proxied by Vite).

### Linux desktop app

`desktop/` is an Electron shell (see [desktop/README.md](desktop/README.md)). Users choose **local mode** — the bundled backend runs with the `desktop` profile (`backend/src/main/java/org/osama/desktop/`): embedded PostgreSQL via zonky, per-launch HS256 token instead of Keycloak, static web app served from the backend on `127.0.0.1:47830`, remote push disabled, and the window blocks all non-loopback requests — or **cloud mode**, which runs a bundled cloud build of the web app from `claritard://app` (`desktop/src/bundledWebApp.js`) and talks to claritard.com only for the API, sign-in and WebSocket; production allows that origin in CORS and Keycloak web origins. The window is frameless with an app-drawn header and ⋮ menu; closing it hides to a tray icon so reminders keep arriving. Frontend code reads `services/desktop.ts` (`isLocalDesktopMode`, `isDesktopApp`, `desktopBridge`) to hide password, logout and web-push UI where they cannot work, and `showSystemNotification` routes through the bridge because Electron's `getNotifications()` never settles.
```bash
cd desktop && npm run build:resources && npm start   # run from source
cd desktop && npm run dist                           # AppImage + .deb in desktop/dist
cd desktop && npm test
```

**Boundaries (app timeouts).** The desktop shell also enforces App-Timeout-style limits on this computer, in both modes: a focused countdown before chosen launchers open, optional auto-close of the app, daily limits for apps and sites (used up = closed and won't open until tomorrow), and Firefox site timers (via the `desktop/firefox-extension` "Claritard URL Gate" and a native messaging host). Logic lives in `desktop/src/timeouts/` (`core/` is plain Node shared with the native host); the web app shows them on the **Boundaries** tab of `/wellbeing` (`frontend/react/src/pages/BoundariesPage.tsx`; `/boundaries` redirects there), present only when `desktopTimeouts` is. Per app, minimized time can be left out of its limits and time-up can minimize instead of quit (KDE only, through KWin scripts in `windowControl.js`); time left shows as a small window or as notifications (`countdownDisplay.js`, no password). Changing any boundary needs a password and a ten second wait (`core/editLock.js`, enforced in the main process); mobile Boundaries waits ten seconds after every password too. Launchers, timers and the native host reach the app through `--timeout-*=value` switches (joined with `=` because Chromium reorders switches); see the Boundaries section of [desktop/README.md](desktop/README.md).

**Screen time.** Opt-in, desktop only, data stays on the computer: `desktop/src/usage/` follows the focused window through a KWin script (KDE) or a GNOME Shell extension (GNOME, needs one new login after first install) that calls a D-Bus service the app owns, detects idle through the Wayland `ext_idle_notifier_v1` protocol on KDE and Mutter's IdleMonitor on GNOME (Electron's idle API returns 0 on Wayland), stops counting while every display is off or unplugged (KWin's `org_kde_kwin_dpms_manager`, KDE only), counts an idle fullscreen window only while its process plays sound (`pactl`), and writes per-day JSON-lines files under `~/.local/share/Claritard/usage/days/`. The web app reads it through `desktopUsage` (`services/desktop.ts`); the Day page's **Plan and screen** card (`frontend/react/src/components/day/`) draws planned events and focus sessions above screen time, with pure layout in `dayTimelineLayout.ts`; the calendar's **Day** view (`/calendar?day=YYYY-MM-DD`, `components/calendar/day-view/`) draws the same lanes as tall columns. The **Digital wellbeing** page (`/wellbeing`, `pages/WellbeingPage.tsx`, tabs in `components/wellbeing/wellbeingTabs.ts`) has Today, a 1W/1M/3M/1Y **Report** and Boundaries. The Report shows **planned and timed** time per activity (chunks from calendar events vs activity timers, plans counted only up to now; pure rules in `planVsTimed.ts`) and, on the desktop, screen time from `desktopUsage.getDailyTotals` (bucketing in `screenTimeReport.ts`). A plain browser gets only the Report tab, without screen time. Copy stays neutral: no targets, no red, idle shown as "away". See the Screen time section of [desktop/README.md](desktop/README.md).

### Android Boundaries

The mobile app's `/boundaries` screens (`frontend/mobile/src/app/boundaries/`) port the Guard Bear app blocker: per-app blocks, daily time, opens per day (an open is an unlock that lasts until the screen locks), time per open, a desktop-style countdown before unlocking and schedules, enforced by an AccessibilityService with optional Shizuku force-stop. When an app is blocked or runs out of time, `AppStopper` first stops its audio (`MediaStopper`: its own media sessions with the optional notification access, otherwise a pause key and audio focus), because without Shizuku Android cannot kill another app's music service. Native code is the local Expo module `frontend/mobile/modules/claritard-boundaries/` (see its README); `src/lib/boundaryRules.ts` must stay in sync with its `AppRule.kt`.

### Database

- **Production**: PostgreSQL on port 5432 (via Docker)
- **Tests**: H2 in-memory; Liquibase disabled; `spring.jpa.hibernate.ddl-auto=create-drop`
- **Migrations**: Liquibase YAML files in `backend/src/main/resources/db/changelog/changes/`; master file is `db.changelog-master.yaml`
- Dev profile uses `spring.liquibase.drop-first=true` (schema is recreated on every start)

### Auth / User Identity

Keycloak is the identity provider. The web browser reaches it through the app-owned `/auth` path (`/auth` is proxied by Vite locally and Caddy in production); the local container listener remains on port 7070 for native development and server-side administration. The backend validates JWTs as an OAuth2 resource server; all API endpoints (except `/actuator/health`) require a valid Bearer token.

**Flow:**
1. `main.tsx` initializes `keycloak-js` with `onLoad: 'login-required'` — the app never renders unless authenticated.
2. Every API call sends `Authorization: Bearer <token>` via `getAuthHeaders()` (`frontend/react/src/services/utils/authHeaders.ts`) for fetch-based calls, or via the axios interceptor in `axiosConfig.ts`.
3. The backend validates the JWT against the Keycloak JWKS (`SecurityConfig.java`).
4. `CurrentUserService.getCurrentUser()` extracts the `Jwt` from the `SecurityContext` and calls `UserService.getOrCreateFromJwt()`, which finds or auto-creates a `User` entity keyed on the Keycloak `sub` claim. Controllers inject `CurrentUserService` instead of reading a header.

`keycloak.ts` (`frontend/react/src/services/keycloak.ts`) configures the Keycloak instance. The realm/client can be overridden via env vars `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` (defaults: `/auth`, `productivity-app`, `productivity-app-frontend`).

**Required Keycloak setup (one-time, via the proxied admin console at http://localhost:5173/auth):**
1. Create realm `productivity-app`.
2. Create client `productivity-app-frontend`: type = Public, valid redirect URIs = `http://localhost:5173/*`, web origins = `http://localhost:5173`.
3. In that client's settings, ensure the token includes `email`, `given_name`, `family_name`, `preferred_username` claims (add mappers under Client scopes if needed). The backend falls back gracefully if claims are absent, but user display will be degraded.

All user-scoped entities (Task, DayEntity, MeditationSession, TaskSession, Pomodoro) have a mandatory `user` foreign key. Users are auto-provisioned on first API call — no manual user creation is needed.

### Frontend (React 18, TypeScript, Vite)

- **State**: React Context — `UserContext` (auth), `TaskContext` (tasks), `ThemeContext`
- **API layer**: `frontend/react/src/services/api/` — `taskService.ts`, `dayService.ts`, `userService.ts`; all wrap Axios with `getAuthHeaders()`
- **UI**: Material-UI (MUI) v7
- **Forms**: Formik + Yup
- **Calendar**: FullCalendar
- **Routing**: React Router v6 (`App.tsx`)
- **Data freshness**: views show cached data at once and refetch in the background; never swap content for a spinner when a copy exists. One heartbeat (`services/utils/appRefresh.ts`, `useAppRefresh`) fires every minute while the window is visible and online, and on focus or reconnect; subscribe to it instead of adding your own timers or focus listeners. Merge refetched data with `keepUnchanged` (`services/utils/keepUnchanged.ts`) so an unchanged answer re-renders nothing and only changed records update. For new read views, `useRevalidatingResource` with a `RevalidatingResource` does all of this (see `useDayOverview`). `PageTransition` keys on the first path segment, so tabs and days within a page (`/wellbeing/*`, `/day/:date`) keep the page mounted; keep sub-views of one page under one path segment.

### Services / Ports

| Service    | Port | Notes                          |
|------------|------|--------------------------------|
| Frontend   | 5173 | Vite dev server                |
| Backend    | 8080 | Spring Boot; also WebSocket    |
| PostgreSQL | 5432 | Docker                         |
| Keycloak   | 7070 | Docker, `start-dev` mode       |
| Desktop local backend | 47830 | Loopback only, `desktop` profile |

Docker services are defined in `deployment/docker-compose.yml`. Environment variables (DB credentials, Keycloak admin) live in `deployment/.env`.

### CI/CD

**Prefix all index names with `idx_app_` to avoid collisions with Keycloak.** Keycloak shares the same PostgreSQL database and creates its own indexes (e.g. `IDX_USER_EMAIL` on `USER_ENTITY`). PostgreSQL index names are unique per schema and case-insensitive, so a plain `idx_user_email` on our `app_user` table collides with Keycloak's index of the same name, causing one of them to fail on startup. Always use `idx_app_<table>_<column>` for our indexes.

**Always use `ifNotExists: true` on `createIndex` in Liquibase changesets.** Partial runs (e.g. a failed startup) can leave indexes in the DB without a corresponding `DATABASECHANGELOG` entry. On the next run Liquibase tries to create them again and fails. `ifNotExists: true` makes index creation idempotent and prevents this.

**Never hardcode credentials in `.properties` files.** All secrets (DB user/password, etc.) live in `deployment/.env` and are referenced via `${ENV_VAR}` placeholders in `application-dev.properties`. `run-app.sh` sources `.env` before starting the backend so Spring Boot can resolve them.

**Always activate the `dev` profile when running locally.** Without `-Dspring-boot.run.profiles=dev`, Spring Boot uses the default profile which has no datasource config — it silently falls back to an in-memory H2 database, losing all data on restart, and no `issuer-uri` is set so the JwtDecoder bean cannot be created. `run-app.sh` passes this flag automatically; when running manually always include it.

**Spring Security `requestMatchers` with multiple servlets.** The H2 dependency is on the runtime classpath (needed for tests), which causes Spring Boot to register an H2 console servlet alongside the `DispatcherServlet`. This makes `requestMatchers(String)` throw an ambiguity error at startup. Always use `AntPathRequestMatcher` explicitly in `SecurityConfig`:
```java
.requestMatchers(new AntPathRequestMatcher("/actuator/health")).permitAll()
```

`.github/workflows/build.yml` runs on push to `master`:
- **Backend**: `mvn clean verify` with Java 21 (Temurin), using H2 test profile
- **Frontend**: `npm install` + `npm run build -- --mode=production` with Node 18

Releases go out automatically on push to `master`, filtered by path. A newer push cancels older runs that are still building (per-job groups in `build.yml`, so a deploy already under way is never cancelled; it queues instead):
- Each production deploy also starts a Netdata server dashboard at `https://claritard.com/monitor/` (basic auth, read-only `netdata` PostgreSQL role); see the Server dashboard section of [deployment/PRODUCTION_DEPLOYMENT.md](deployment/PRODUCTION_DEPLOYMENT.md).
- `release-desktop.yml` publishes the AppImage, `.deb` (repacked by `desktop/scripts/debDifferential.js`, with its `.blockmap`) and `latest-linux.yml` as the latest GitHub release (version `<major>.<minor>` from `VERSION`, commit count as patch). Installed desktop apps update through `electron-updater` (`desktop/src/autoUpdate.js`; `"autoUpdate": false` in the desktop config turns it off), downloading only changed blocks; see "Updates download only what changed" in [desktop/README.md](desktop/README.md).
- `release-mobile.yml` publishes the production APK as a **prerelease** titled `Claritard Mobile …`, so it stays out of `/releases/latest` and the desktop updater ignores it. Devices install it through Obtainium. `ANDROID_VERSION_CODE` (commit count) sets `versionCode` in `app.config.js` and the Android `versionName` (`1.2.0-<count>`, via `plugins/withBuildNumberVersionName.js`) so Obtainium sees each build as new; the expo `version` stays fixed because `runtimeVersion` follows it.

## Coding Style

**No redundant comments.** Comments explain *why*, not *what*. If a comment adds nothing beyond reading the code, delete it. In tests, section-labelling comments are acceptable — tests serve as documentation.

**Document serious limitations.** Thread-safety caveats, known edge cases, and non-obvious constraints must be stated in comments or docstrings. These are not redundant — they prevent bugs.

**Small files and methods.** Keep functions short and focused on one thing. Split files when they grow beyond a single clear responsibility. Directory structure should reflect the architecture — a new contributor should be able to guess where code lives.

**Modular, testable code.** Small functions with clear inputs and outputs. Prefer pure functions where possible. If something is hard to test, restructure it rather than working around it.

**Tests are documentation.** Test names and structure should teach a reader how the system behaves. A new developer should be able to read the tests and understand the API, edge cases, and invariants. Prioritize clarity over cleverness.

**Real tests, minimal mocks.** Test actual behavior through real code paths. Only mock at true system boundaries (external services, network, filesystem). Never mock internal classes just to isolate a unit.

**Always log caught exceptions with the exception object.** Use `logger.error("context: {}", e.getMessage(), e)` (Java) or equivalent so the full stack trace appears in the log. Never swallow exceptions silently or log only a generic message.

**Don't add what wasn't asked for.** If the task is "write tests", don't modify production code without asking. Don't add features, abstractions, or considerations that weren't requested. When in doubt, ask first.

**Add new files to git — always, unless there's a clear reason not to.** When creating a new file, stage it with `git add`. Only skip this if the file contains secrets, is generated/build output, or is otherwise intentionally untracked.

## Mistakes

After a non-trivial mistake, Claude must ask the user: "Should I add a note to CLAUDE.md to prevent this from happening again?"

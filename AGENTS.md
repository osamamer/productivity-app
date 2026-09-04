> **Living document.** Keep this file up to date as the codebase evolves. When a section grows large, move the detail into a subdirectory `AGENTS.md` (e.g. `backend/tests/AGENTS.md`, `openapi/AGENTS.md`) and leave a brief summary with a link here. Depth lives close to the code; this file stays navigable.

## Project Overview

Claritard is a full-stack productivity app ("So Life Doesn't Get Overwhelming") for managing tasks, focus sessions, meditation, and daily planning. Built with Spring Boot + React/TypeScript.

## Commands
### Shell environment

The developer uses Fish (`/usr/bin/fish`) as the interactive shell. Do not tell them to source `~/.profile` from Fish; that file contains POSIX/Bash syntax. The original NVM (`nvm.sh`) is Bash-only, so Fish uses the `bass` bridge and the saved `nvm` function in its Fish configuration.


### Running the Full App
```bash
./run-app.sh
```
This reuses healthy Docker services (PostgreSQL and Keycloak) and existing healthy app processes, starting only what is missing. It also starts the mobile Metro server when its dependencies are installed and forwards connected Android devices to the local Keycloak, backend, and Metro ports. It never uses `sudo` or kills arbitrary port owners. Ctrl+C stops only the backend, frontend, and mobile Metro processes started by that invocation; Docker services remain available for the next run.

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

### Dev Coach CLI
```bash
./dev-coach/devcoach doctor                         # Check Java, Codex, Git, skill, and state storage
./dev-coach/devcoach start "describe the change"   # Start a guided lesson session
./dev-coach/devcoach resume                         # Resume this repository's session
./backend/mvnw -f dev-coach/pom.xml test            # Run CLI tests
```

## Architecture

### Backend (Spring Boot 3.1.3, Java 21, Maven)

Package root: `org.osama`

Feature packages follow a consistent pattern — each has an entity, repository, service, and controller:
- `task/` — Task CRUD with filtering via JPA Specifications (`TaskSpecifications.java`); tasks may optionally originate from a mental thread
- `taskgroup/` — User-owned groups that relate multiple tasks independently of subtasks
- `mentalthread/` — User-owned unresolved concerns with acting/ruminating/planned/pending attention states, subjective load history, closure outcomes, daily capacity check-ins, and connected next-action tasks
- `day/` — Daily rating/plan/summary (`DayEntity`, one per user per date)
- `pomodoro/` — Pomodoro timer settings, persisted phase state, and automatic/manual phase transitions
- `reminder/` — Durable, typed notification inbox shared by calendar reminders and Pomodoro transitions; notifications remain due until the client acknowledges presentation, while authenticated WebSocket pushes are only a low-latency delivery signal
- `stat/` — Daily user-defined tracking plus built-in meditation activity and sleep stats provisioned from `SystemStatCatalog`; built-ins use a stable `systemKey`, cannot be deleted, and expose server-side personal correlation insights
- `mentalstate/` — Timestamped, multiple-per-day check-ins that capture energy, activation, stimulation hunger, clarity, valence, and emotional load together and generate deterministic state guidance
- `session/task/` and `session/meditation/` — Session tracking with start/pause/unpause/end lifecycle, published as Spring events via `ApplicationEventPublisher`
- `scheduling/` — Automated job scheduling for pomodoro cycles (`TimedExecutorService`, `ScheduledJob`)
- `user/` — User management and persisted preferences backed by Keycloak (see Auth below)

WebSocket (STOMP) is configured in `WebSocketConfig.java`. The frontend connects via `/ws` (proxied by Vite).

Reminder delivery is database-first. `ScheduledJobExecutor` locks and runs each due Pomodoro job in one transaction with creation of its notification, while `NotificationService` retries WebSocket pushes for unacknowledged due records. The app-wide frontend `NotificationCenter` owns the single authenticated socket, synchronizes `/api/v1/notifications/due` on startup/reconnect/focus/visibility/online changes and on a recovery interval, presents either an OS notification or a queued in-app fallback, then acknowledges it. Never add feature-specific ephemeral notification sockets; create another typed durable notification instead.

### Database

- **Production**: PostgreSQL on port 5432 (via Docker)
- **Tests**: H2 in-memory; Liquibase disabled; `spring.jpa.hibernate.ddl-auto=create-drop`
- **Migrations**: Liquibase YAML files in `backend/src/main/resources/db/changelog/changes/`; master file is `db.changelog-master.yaml`. Mental threads, load history, daily capacity check-ins, task connections, and the Sleep system stat are persisted by the latest migrations.
- Dev applies Liquibase migrations incrementally with `spring.liquibase.drop-first=false`; PostgreSQL data persists in the named `postgres_data` Docker volume across normal app restarts

### Auth / User Identity

Keycloak (port 7070) is the identity provider. The backend validates JWTs as an OAuth2 resource server; all API endpoints (except `/actuator/health`) require a valid Bearer token.

**Flow:**
1. `main.tsx` initializes `keycloak-js` with `onLoad: 'login-required'` — the app never renders unless authenticated.
2. Every API call sends `Authorization: Bearer <token>` via `getAuthHeaders()` (`frontend/react/src/services/utils/authHeaders.ts`) for fetch-based calls, or via the axios interceptor in `axiosConfig.ts`.
3. The backend validates the JWT against the Keycloak JWKS (`SecurityConfig.java`).
4. `CurrentUserService.getCurrentUser()` extracts the `Jwt` from the `SecurityContext` and calls `UserService.getOrCreateFromJwt()`, which finds or auto-creates a `User` entity keyed on the Keycloak `sub` claim. Controllers inject `CurrentUserService` instead of reading a header.

`keycloak.ts` (`frontend/react/src/services/keycloak.ts`) configures the Keycloak instance. The realm/client can be overridden via env vars `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` (defaults: `http://localhost:7070`, `productivity-app`, `productivity-app-frontend`). The launcher uses dedicated process groups for Maven/Vite and targeted port-owner cleanup; it never kills listeners owned by another account or unidentified root/system processes.

**Required Keycloak setup (one-time, via admin console at http://localhost:7070):**
1. Create realm `productivity-app`.
2. Create client `productivity-app-frontend`: type = Public, valid redirect URIs = `http://localhost:5173/*`, web origins = `http://localhost:5173`.
3. In that client's settings, ensure the token includes `email`, `given_name`, `family_name`, `preferred_username` claims (add mappers under Client scopes if needed). The backend falls back gracefully if claims are absent, but user display will be degraded.
4. Local `run-app.sh` applies the `productivity` Login Theme and enables self-registration for the app realm automatically. For production, select `productivity` in Realm settings → Themes and enable User registration under Realm settings → Login. The theme is mounted from `deployment/keycloak-theme` by both Docker Compose files and keeps Keycloak's secure OIDC form flow while matching the app's visual language.

All user-scoped entities (Task, DayEntity, MeditationSession, TaskSession, Pomodoro, MentalThread, MentalCapacityCheckIn) have a mandatory `user` foreign key. Users are auto-provisioned on first API call — no manual user creation is needed.

### Frontend (React 18, TypeScript, Vite)

- **State**: React Context — `UserContext` (auth), `TaskContext` (tasks), `ThemeContext`
- **API layer**: `frontend/react/src/services/api/` — feature services such as `taskService.ts`, `dayService.ts`, and `mentalThreadService.ts`; authenticated requests use `getAuthHeaders()`
- **UI**: Material-UI (MUI) v7
- **Forms**: Formik + Yup
- **Calendar**: FullCalendar
- **Routing**: React Router v6 (`App.tsx`)
- **Notes**: `pages/NotesPage.tsx` and `components/notes/`; the frontend calls the planned authenticated API through `services/api/notesService.ts`, with its backend contract tracked in `backend/NOTES_BACKEND_TODO.md`
- **Mental threads**: `pages/MentalThreadsPage.tsx` and `components/mental-threads/`; the dashboard keeps total subjective load separate from the user's daily capacity check-in
- **Mental state**: `pages/MentalStatePage.tsx` and `components/mental-state/`; each check-in records six signals together, calculates private derived scores on the backend, returns only state and suggested actions, and supports multiple entries per day

### Services / Ports

| Service    | Port | Notes                          |
|------------|------|--------------------------------|
| Frontend   | 5173 | Vite dev server                |
| Backend    | 8080 | Spring Boot; also WebSocket    |
| PostgreSQL | 5432 | Docker                         |
| Keycloak   | 7070 | Docker, `start-dev` mode       |

Docker services are defined in `deployment/docker-compose.yml`. Environment variables (DB credentials, Keycloak admin) live in `deployment/.env`.

### Dev Coach

`dev-coach/` is a standalone Java 17 CLI and does not depend on the Spring Boot application. It calls `codex exec` in a read-only sandbox, validates course/lesson/assessment responses against bundled JSON Schemas, and stores resumable state outside the repository. The repo-scoped `.agents/skills/guided-development/` skill defines the teaching and assessment workflow. Keep rendering and session control in the CLI; keep repository-aware teaching decisions in the skill and Codex adapter.

### CI/CD

**Prefix all index names with `idx_app_` to avoid collisions with Keycloak.** Keycloak shares the same PostgreSQL database and creates its own indexes (e.g. `IDX_USER_EMAIL` on `USER_ENTITY`). PostgreSQL index names are unique per schema and case-insensitive, so a plain `idx_user_email` on our `app_user` table collides with Keycloak's index of the same name, causing one of them to fail on startup. Always use `idx_app_<table>_<column>` for our indexes.

**Always use `ifNotExists: true` on `createIndex` in Liquibase changesets.** Partial runs (e.g. a failed startup) can leave indexes in the DB without a corresponding `DATABASECHANGELOG` entry. On the next run Liquibase tries to create them again and fails. `ifNotExists: true` makes index creation idempotent and prevents this.

**Never edit a Liquibase changeset after it may have been applied.** Liquibase stores each applied changeset's checksum in `DATABASECHANGELOG`; changing the file later prevents startup with a checksum validation failure. Restore the applied changeset exactly and put every subsequent schema or data change in a new, sequentially numbered changeset. Never work around this with `clearCheckSums` or `validCheckSum` unless the user explicitly authorizes a deliberate migration-history repair.

**Keycloak schema backups include its Liquibase ledger.** Never copy or restore Keycloak tables without `databasechangelog` and `databasechangeloglock`. Keycloak's schema and migration history are one recovery unit; separating them makes Keycloak replay its initial migrations against existing tables. Keep the production Keycloak image pinned, and perform version upgrades only as explicit maintenance with a verified full backup. When an application migration creates a table, add that table to `app_tables` in `deployment/migrate-keycloak-database.sh` so the legacy split tool cannot copy it into the Keycloak database.

**Never hardcode credentials in `.properties` files.** All secrets (DB user/password, etc.) live in `deployment/.env` and are referenced via `${ENV_VAR}` placeholders in `application-dev.properties`. `run-app.sh` sources `.env` before starting the backend so Spring Boot can resolve them.

**Always activate the `dev` profile when running locally.** Without `-Dspring-boot.run.profiles=dev`, Spring Boot uses the default profile which has no datasource config — it silently falls back to an in-memory H2 database, losing all data on restart, and no `issuer-uri` is set so the JwtDecoder bean cannot be created. `run-app.sh` passes this flag automatically; when running manually always include it.

**Never enable Liquibase `drop-first` in the dev profile.** Local development data must survive restarts and schema changes must be delivered as forward Liquibase changesets. Docker Compose uses the named `postgres_data` volume; normal `docker compose down` is safe, but `docker compose down -v` intentionally deletes that data.

**Spring Security `requestMatchers` with multiple servlets.** The H2 dependency is on the runtime classpath (needed for tests), which causes Spring Boot to register an H2 console servlet alongside the `DispatcherServlet`. This makes `requestMatchers(String)` throw an ambiguity error at startup. Always use `AntPathRequestMatcher` explicitly in `SecurityConfig`:
```java
.requestMatchers(new AntPathRequestMatcher("/actuator/health")).permitAll()
```

`.github/workflows/build.yml` runs on push to `master`:
- **Backend**: `mvn clean verify` with Java 21 (Temurin), using H2 test profile
- **Frontend**: `npm install` + `npm run build -- --mode=production` with Node 18

## Coding Style

**No redundant comments.** Comments explain *why*, not *what*. If a comment adds nothing beyond reading the code, delete it. In tests, section-labelling comments are acceptable — tests serve as documentation.

**Document serious limitations.** Thread-safety caveats, known edge cases, and non-obvious constraints must be stated in comments or docstrings. These are not redundant — they prevent bugs.

**Small files and methods.** Keep functions short and focused on one thing. Split files when they grow beyond a single clear responsibility. Directory structure should reflect the architecture — a new contributor should be able to guess where code lives.

**Modular, testable code.** Small functions with clear inputs and outputs. Prefer pure functions where possible. If something is hard to test, restructure it rather than working around it.

**Tests are documentation.** Test names and structure should teach a reader how the system behaves. A new developer should be able to read the tests and understand the API, edge cases, and invariants. Prioritize clarity over cleverness.

**Rendering and loading behavior.** The user cares very much about how the interface renders and about flashes or visual jumps while content is loading. Whenever implementing a feature, treat state shape, caching, loading transitions, and render behavior as part of the feature: preserve stable UI where possible, avoid unnecessary loading flashes, and prevent avoidable full rerenders. Prefer targeted state updates, memoization or stable references when they materially help, and cache or prefetch data when appropriate so already-visible content does not needlessly disappear and reappear.

**Optimistic interactions and animations.** Direct-manipulation controls such as sliders, toggles, and inline edits must update visible state immediately, remain interactive while persistence is in flight, and avoid a `Saving` indicator for each small auto-save. Guard optimistic mutations against out-of-order responses so an older request cannot overwrite a newer value, and roll back only the latest failed mutation. For FLIP or layout animations, key the animation effect from layout-affecting values such as order, size, status, or displayed labels, not whole response objects or timestamps; backend reconciliation must not replay a completed animation or cause a bounce. Test rapid repeated changes with delayed responses.

**Real tests, minimal mocks.** Test actual behavior through real code paths. Only mock at true system boundaries (external services, network, filesystem). Never mock internal classes just to isolate a unit.

**Always log caught exceptions with the exception object.** Use `logger.error("context: {}", e.getMessage(), e)` (Java) or equivalent so the full stack trace appears in the log. Never swallow exceptions silently or log only a generic message.

**Backend event logging.** Log successful user-visible state changes at `INFO` with the user and resource identifiers plus relevant structured values. Keep read-only queries quiet, use `WARN` for rejected input or missing resources, and never log passwords, access tokens, or free-form private text unless the feature explicitly requires it (stat values are intentional audit data).

**User-facing errors.** Translate authentication and API failures into concise, user-oriented messages at the UI boundary. Never display provider names (including Keycloak), OAuth/OIDC grant or protocol terminology, endpoint URLs, hostnames, raw exception text, or raw response descriptions to users. Keep implementation details in developer-facing logs and diagnostics only.

**Prefer direct manipulation over obvious instructional UI.** Do not add permanent helper text, drag handles, or mode-launch buttons for interactions users can perform directly on the content. Make the content itself draggable/selectable, provide immediate visual feedback, and reveal contextual actions only after they become relevant. Keep grouped items inline with the list they organize, and let focus modes fully remove distractions until the user explicitly reveals them.

**Modal and popup preference.** The user does not like large modals that blur the whole app. Prefer inline editing and small anchored popups for confirmations or contextual actions.

**Mobile keyboard visibility.** Every new mobile screen, form, sheet, or popup that accepts text must use the shared keyboard-aware surfaces (`Screen`, `ModalSheet`, `KeyboardAwareScrollView`, or `KeyboardAwareView`) so the focused field remains visible above the opened keyboard. Do not add a standalone scroll view around inputs without keyboard avoidance and focused-input reveal behavior.

**Mobile date input preference.** When a mobile scheduling control offers a date choice, use a `Custom` action that opens a themed date/time popup. Do not leave a `Someday` action that silently means “no date.”

**Don't add what wasn't asked for.** If the task is "write tests", don't modify production code without asking. Don't add features, abstractions, or considerations that weren't requested. When in doubt, ask first.

**Add new files to git — always, unless there's a clear reason not to.** When creating a new file, stage it with `git add`. Only skip this if the file contains secrets, is generated/build output, or is otherwise intentionally untracked.

**Explain completed work.** After implementing a feature or non-trivial change, show the user the important parts of the code and explain the design, including anything interesting, non-obvious, or worth learning from. Keep the handoff focused on the decisions that help the user understand and maintain the change.

**Frontend-first backend handoffs.** When asked to finish a frontend and leave backend TODOs, build the frontend against the authenticated API as though that backend already exists. Also create compile-ready backend scaffolding—entities, DTOs, repositories, controllers, service signatures, migrations, and test structure—so the remaining TODOs cover meaningful behavior rather than boilerplate. Never substitute browser persistence unless the user explicitly requests an offline or local-first mode.

## Mistakes

After a non-trivial mistake, Codex must ask the user: "Should I add a note to AGENTS.md to prevent this from happening again?"

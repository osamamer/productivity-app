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
This kills existing processes on ports 8080, 5173, 7070, 3000, 5432, starts Docker services (PostgreSQL, Keycloak, Grafana), then starts the backend and frontend.

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

## Architecture

### Backend (Spring Boot 3.1.3, Java 17, Maven)

Package root: `org.osama`

Feature packages follow a consistent pattern — each has an entity, repository, service, and controller:
- `task/` — Task CRUD with filtering via JPA Specifications (`TaskSpecifications.java`)
- `day/` — Daily rating/plan/summary (`DayEntity`, one per user per date)
- `pomodoro/` — Pomodoro timer settings and state
- `session/task/` and `session/meditation/` — Session tracking with start/pause/unpause/end lifecycle, published as Spring events via `ApplicationEventPublisher`
- `scheduling/` — Automated job scheduling for pomodoro cycles (`TimedExecutorService`, `ScheduledJob`)
- `user/` — User management backed by Keycloak (see Auth below)

WebSocket (STOMP) is configured in `WebSocketConfig.java`. The frontend connects via `/ws` (proxied by Vite).

### Database

- **Production**: PostgreSQL on port 5432 (via Docker)
- **Tests**: H2 in-memory; Liquibase disabled; `spring.jpa.hibernate.ddl-auto=create-drop`
- **Migrations**: Liquibase YAML files in `backend/src/main/resources/db/changelog/changes/`; master file is `db.changelog-master.yaml`
- Dev profile uses `spring.liquibase.drop-first=true` (schema is recreated on every start)

### Auth / User Identity

Keycloak (port 7070) is the identity provider. The backend validates JWTs as an OAuth2 resource server; all API endpoints (except `/actuator/health`) require a valid Bearer token.

**Flow:**
1. `main.tsx` initializes `keycloak-js` with `onLoad: 'login-required'` — the app never renders unless authenticated.
2. Every API call sends `Authorization: Bearer <token>` via `getAuthHeaders()` (`frontend/react/src/services/utils/authHeaders.ts`) for fetch-based calls, or via the axios interceptor in `axiosConfig.ts`.
3. The backend validates the JWT against the Keycloak JWKS (`SecurityConfig.java`).
4. `CurrentUserService.getCurrentUser()` extracts the `Jwt` from the `SecurityContext` and calls `UserService.getOrCreateFromJwt()`, which finds or auto-creates a `User` entity keyed on the Keycloak `sub` claim. Controllers inject `CurrentUserService` instead of reading a header.

`keycloak.ts` (`frontend/react/src/services/keycloak.ts`) configures the Keycloak instance. The realm/client can be overridden via env vars `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` (defaults: `http://localhost:7070`, `productivity-app`, `productivity-app-frontend`).

**Required Keycloak setup (one-time, via admin console at http://localhost:7070):**
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

### Services / Ports

| Service    | Port | Notes                          |
|------------|------|--------------------------------|
| Frontend   | 5173 | Vite dev server                |
| Backend    | 8080 | Spring Boot; also WebSocket    |
| PostgreSQL | 5432 | Docker                         |
| Keycloak   | 7070 | Docker, `start-dev` mode       |
| Grafana    | 3000 | Docker, anonymous access on    |

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
- **Backend**: `mvn clean verify` with Java 17 (Temurin), using H2 test profile
- **Frontend**: `npm install` + `npm run build -- --mode=production` with Node 18

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

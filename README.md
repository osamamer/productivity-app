# Claritard

Claritard is a full-stack productivity app for tasks, daily planning, focus
sessions, meditation, notes, calendar events, mental threads, and personal
tracking. Its goal is simple: so life doesn't get overwhelming.

The repository contains a Spring Boot API, a React web app, a Keycloak identity
provider, and a PostgreSQL database. The mobile client lives in
[`frontend/mobile/`](frontend/mobile/) and has its own setup guide.

## Run locally

### Prerequisites

Install the following before starting:

- Git
- Docker Engine or Docker Desktop with the Compose plugin
- Java 21 (the backend includes a Maven wrapper, so Maven itself is not required)
- Node.js 22 or newer with npm
- `curl`

The local stack uses these ports:

| Service | URL |
| --- | --- |
| Web app | <http://localhost:5173> |
| Mobile Metro | <http://localhost:8081> |
| Backend health check | <http://localhost:8080/actuator/health> |
| Keycloak | <http://localhost:7070> |
| PostgreSQL | `localhost:5432` |

### First run

From the repository root:

```sh
./run-app.sh
```

If `deployment/.env` does not exist, the launcher creates it from the
development example. Copy and edit `deployment/.env.example` yourself first if
you want to change the local database or Keycloak credentials.

Open <http://localhost:5173>. On a fresh database, the launcher starts
PostgreSQL and Keycloak, imports the local `productivity-app` realm and public
web client, installs the web dependencies, starts the backend with the `dev`
profile, and applies database migrations. Choose **Create account** on the
Keycloak login page to register a local user. If Android SDK tools, Java 21,
and a connected device or already-running emulator are available, it also
starts Metro and builds/launches the native Android app. If no device is
connected and exactly one Android AVD is configured, it starts that AVD with
two virtual cores and 2 GB RAM; multiple AVDs require
`CLARITARD_ANDROID_AVD`. The Android build is deliberately limited to two
Gradle/CMake workers and runs without a persistent Gradle daemon. Set
`CLARITARD_MOBILE_ANDROID=0` to skip native Android, or
`CLARITARD_ANDROID_EMULATOR=0` to leave emulator startup to you.

The values in `deployment/.env.example` are development-only credentials. Keep
`deployment/.env` uncommitted and use strong, separate values for any shared or
production environment.

Press `Ctrl+C` to stop the backend, frontend, Metro, and emulator processes
started by this run. The launcher stops their complete process groups, so
Maven, Vite, Metro, or emulator children do not remain behind. The installed
Android app is not stopped. The Docker services stay running, so the next
`./run-app.sh` starts quickly.

### Stop or reset local services

Stop the Docker services while keeping the database volume:

```sh
docker compose --env-file deployment/.env \
  -f deployment/docker-compose.yml -p productivity-app down
```

To deliberately delete all local PostgreSQL and Keycloak data, use:

```sh
docker compose --env-file deployment/.env \
  -f deployment/docker-compose.yml -p productivity-app down -v
```

The `-v` form is destructive. It is useful if you want a completely clean
first-run setup, but it will remove local users, tasks, and other app data.

## Development commands

The launcher is the recommended path. These commands are useful when working
on one part of the stack or when diagnosing a startup problem.

Start infrastructure only:

```sh
docker compose --env-file deployment/.env \
  -f deployment/docker-compose.yml -p productivity-app up -d
```

Run the backend:

```sh
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Run the web app:

```sh
cd frontend/react
npm ci                 # first run, or after package-lock.json changes
npm run dev
```

Run checks:

```sh
(cd backend && ./mvnw test)
(cd frontend/react && npm run lint)
(cd frontend/react && npm run build)
```

The backend test profile uses an in-memory H2 database and disables Liquibase.
Local development uses PostgreSQL and Liquibase with `drop-first=false`, so
normal restarts preserve data.

## Configuration

`deployment/.env` supplies the local PostgreSQL and Keycloak settings. The
available values are documented by [`deployment/.env.example`](deployment/.env.example).
The most useful optional setting during development is:

```dotenv
POMODORO_DEV_SECONDS_MODE=true
```

This makes Pomodoro phases last seconds instead of their normal durations. Do
not use it for production.

The React app has sensible localhost defaults. To point it at a different
backend or Keycloak instance, create `frontend/react/.env.local` with any of:

```dotenv
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
VITE_KEYCLOAK_URL=http://localhost:7070
VITE_KEYCLOAK_REALM=productivity-app
VITE_KEYCLOAK_CLIENT_ID=productivity-app-frontend
```

If you change the realm or client, update the Keycloak configuration and the
frontend values together.

## Project layout

- `backend/` — Spring Boot API, scheduled jobs, Liquibase migrations, and tests
- `frontend/react/` — React + TypeScript web application
- `frontend/mobile/` — Expo mobile application; see its README
- `deployment/` — local/production Compose files, Dockerfiles, and Keycloak theme
- `run-app.sh` — local orchestration script
- `dev-coach/` — optional guided development CLI

For production deployment, see
[`deployment/PRODUCTION_DEPLOYMENT.md`](deployment/PRODUCTION_DEPLOYMENT.md).

## Troubleshooting

- **Docker permission denied:** make sure Docker is running and your account can
  access the Docker socket. On Linux, add the account to the `docker` group and
  log in again.
- **A port is already in use:** the launcher identifies the exact listener. It
  stops unrelated Docker containers publishing the required ports, detected
  system PostgreSQL clusters on `5432`, and same-user listeners on the app
  ports. It refuses to kill a listener owned by another account or one it
  cannot identify safely; stop that owner manually, then run the launcher
  again.
- **Login fails after an old local setup:** the imported realm is applied only
  when the realm does not already exist. If the old volume has an incomplete
  Keycloak setup, either finish the realm/client setup in the Keycloak admin
  console or reset the local volume with the destructive command above.
- **Backend does not start:** check the backend terminal output and confirm that
  the `dev` profile is active. Running without that profile falls back to the
  default configuration, which is not the local PostgreSQL/Keycloak setup.
- **Inspect container logs:**

  ```sh
  docker compose --env-file deployment/.env \
    -f deployment/docker-compose.yml -p productivity-app logs -f postgres keycloak
  ```

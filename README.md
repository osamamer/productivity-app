# Productivity App - So Life Doesn't Get Overwhelming
An app designed to help you manage various aspects of your life while keeping things light and fun.

## Tech Stack Used
**Backend**: Java and SpringBoot.

**Frontend**: React and Material UI.

Build the docker image with:
```sh
./deployment/build-docker-image.sh
```

For a production deployment on a single VPS, see
[`deployment/PRODUCTION_DEPLOYMENT.md`](deployment/PRODUCTION_DEPLOYMENT.md).
Rerun the app after making changes to the backend:
```sh
./rerun-after-changes.sh
```

## Local databases

The application and Keycloak use separate databases in the same PostgreSQL container. A fresh PostgreSQL volume creates the database named by `KEYCLOAK_DB` automatically.

For an existing installation that still has both sets of tables in `POSTGRES_DB`, run the one-time migration while the app is stopped:

```sh
./deployment/migrate-keycloak-database.sh
```

The script creates a full backup before copying Keycloak's tables and refuses to overwrite a non-empty target database. Keep the backup and `postgres_data` volume until application data and Keycloak login have been verified.

After verification, archive the old copied Keycloak tables outside the application's `public` schema so IntelliJ shows only application tables there:

```sh
./deployment/archive-legacy-keycloak-tables.sh --confirm
```

This cleanup requires a migration backup and a non-empty realm in the new Keycloak database. It moves tables to the reversible `legacy_keycloak` schema; it does not delete data, remove the PostgreSQL volume, or remove the backup.

## Dev Coach

`dev-coach` turns a development goal into repository-grounded lessons backed by Codex. It explains the current concept, identifies the code target, reveals progressive hints, and assesses the current working tree without editing it.

```sh
./dev-coach/devcoach doctor
./dev-coach/devcoach start "add validation to task creation"
./dev-coach/devcoach resume
```

Use `--repo PATH` to coach a different Git repository and `--mode pair` for earlier scaffolding. Sessions are stored under `$XDG_STATE_HOME/devcoach` or `~/.local/state/devcoach`, not in the repository.

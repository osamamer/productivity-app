#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "${script_dir}/.." && pwd)
env_file="${script_dir}/.env"
compose_file="${script_dir}/docker-compose.yml"
backup_dir="${script_dir}/backups"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}. Copy deployment/.env.example to deployment/.env first." >&2
  exit 1
fi

# shellcheck disable=SC1091
source "${env_file}"

: "${POSTGRES_USER:?POSTGRES_USER must be set in deployment/.env}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in deployment/.env}"
: "${KEYCLOAK_DB:?KEYCLOAK_DB must be set in deployment/.env}"

if [[ "${POSTGRES_DB}" == "${KEYCLOAK_DB}" ]]; then
  echo "POSTGRES_DB and KEYCLOAK_DB must be different databases." >&2
  exit 1
fi

compose=(docker compose --env-file "${env_file}" -f "${compose_file}" -p productivity-app)

cd "${repo_dir}"
mkdir -p "${backup_dir}"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
full_backup="${backup_dir}/${POSTGRES_DB}-before-keycloak-split-${timestamp}.dump"
keycloak_dump="${backup_dir}/keycloak-tables-${timestamp}.dump"

echo "Ensuring PostgreSQL is running..."
"${compose[@]}" up -d postgres >/dev/null

echo "Waiting for PostgreSQL to accept connections..."
for attempt in {1..30}; do
  if "${compose[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" == 30 ]]; then
    echo "PostgreSQL did not become ready." >&2
    exit 1
  fi
  sleep 2
done

echo "Creating a full backup at ${full_backup}..."
"${compose[@]}" exec -T postgres pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" > "${full_backup}"
sha256sum "${full_backup}" > "${full_backup}.sha256"

echo "Stopping Keycloak to make the copy consistent..."
"${compose[@]}" stop keycloak >/dev/null || true

echo "Checking whether ${KEYCLOAK_DB} already contains tables..."
existing_table_count=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --command "select count(*) from pg_tables where schemaname = 'public';" 2>/dev/null || true)

if [[ -n "${existing_table_count}" && "${existing_table_count}" != "0" ]]; then
  echo "${KEYCLOAK_DB} already contains tables; refusing to overwrite it." >&2
  echo "The original database is unchanged. Review the database and rerun only after choosing a safe target." >&2
  exit 1
fi

echo "Creating ${KEYCLOAK_DB} if it does not exist..."
"${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=ON_ERROR_STOP=1 \
  --variable=keycloak_db="${KEYCLOAK_DB}" <<'SQL'
SELECT format('CREATE DATABASE %I', :'keycloak_db')
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = :'keycloak_db'
)
\gexec
SQL

echo "Dumping Keycloak tables only..."
"${compose[@]}" exec -T postgres pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --exclude-table=public.app_user \
  --exclude-table=public.day_entity \
  --exclude-table=public.databasechangelog \
  --exclude-table=public.databasechangeloglock \
  --exclude-table=public.meditation_session \
  --exclude-table=public.pomodoro \
  --exclude-table=public.project \
  --exclude-table=public.reminder \
  --exclude-table=public.scheduled_job \
  --exclude-table=public.stat_definition \
  --exclude-table=public.stat_entry \
  --exclude-table=public.task \
  --exclude-table=public.task_session > "${keycloak_dump}"
sha256sum "${keycloak_dump}" > "${keycloak_dump}.sha256"

echo "Restoring Keycloak tables into ${KEYCLOAK_DB}..."
"${compose[@]}" exec -T postgres pg_restore \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" < "${keycloak_dump}"

echo "Verifying the split..."
app_table_count=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --tuples-only \
  --no-align \
  --command "select count(*) from pg_tables where schemaname = 'public';")
keycloak_table_count=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --command "select count(*) from pg_tables where schemaname = 'public';")

echo "${POSTGRES_DB} public tables: ${app_table_count}"
echo "${KEYCLOAK_DB} public tables: ${keycloak_table_count}"

if "${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --command "select 1 from pg_tables where schemaname = 'public' and tablename in ('app_user', 'task', 'databasechangelog') limit 1;" | rg -q '^1$'; then
  echo "Application tables were found in ${KEYCLOAK_DB}; refusing to start Keycloak." >&2
  exit 1
fi

echo "Starting Keycloak against ${KEYCLOAK_DB}..."
"${compose[@]}" up -d keycloak >/dev/null

echo
echo "Migration complete. Full backup: ${full_backup}"
echo "Keep the backup and the original PostgreSQL volume until you verify login and application data."

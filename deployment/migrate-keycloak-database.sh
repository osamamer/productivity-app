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
app_tables=(
  app_user
  calendar_event
  day_entity
  meditation_session
  mental_capacity_check_in
  mental_state_check_in
  mental_thread
  mental_thread_load_entry
  note
  note_category
  pomodoro
  project
  reminder
  scheduled_job
  stat_definition
  stat_entry
  task
  task_group
  task_group_task
  task_session
)

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

echo "Stopping Keycloak before taking the migration snapshots..."
"${compose[@]}" stop keycloak >/dev/null || true

source_changelog_exists=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --tuples-only \
  --no-align \
  --set=ON_ERROR_STOP=1 \
  --command "select to_regclass('public.databasechangelog') is not null;" | tr -d '[:space:]')
if [[ "${source_changelog_exists}" != "t" ]]; then
  echo "The source database has no Liquibase migration ledger; refusing to create an incomplete Keycloak copy." >&2
  exit 1
fi

source_keycloak_change_count=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --tuples-only \
  --no-align \
  --set=ON_ERROR_STOP=1 \
  --command "select count(*) from public.databasechangelog where filename like 'META-INF/%';" | tr -d '[:space:]')
if [[ ! "${source_keycloak_change_count}" =~ ^[0-9]+$ || "${source_keycloak_change_count}" == "0" ]]; then
  echo "The source database has no Keycloak migration history; refusing to copy its schema tables." >&2
  exit 1
fi

echo "Creating a full backup at ${full_backup}..."
"${compose[@]}" exec -T postgres pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" > "${full_backup}"
sha256sum "${full_backup}" > "${full_backup}.sha256"

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
keycloak_dump_command=(
  "${compose[@]}" exec -T postgres pg_dump
  --format=custom
  --no-owner
  --no-privileges
  --username "${POSTGRES_USER}"
  --dbname "${POSTGRES_DB}"
)
for table_name in "${app_tables[@]}"; do
  keycloak_dump_command+=("--exclude-table=public.${table_name}")
done
"${keycloak_dump_command[@]}" > "${keycloak_dump}"
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

app_table_list=$(printf "'%s'," "${app_tables[@]}")
app_table_list=${app_table_list%,}
if "${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --command "select 1 from pg_tables where schemaname = 'public' and tablename in (${app_table_list}) limit 1;" | rg -q '^1$'; then
  echo "Application tables were found in ${KEYCLOAK_DB}; refusing to start Keycloak." >&2
  exit 1
fi

# Keycloak's tables and its Liquibase ledger form one indivisible backup. Without
# the ledger, Keycloak replays its initial migration against the restored tables.
keycloak_change_count=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --set=ON_ERROR_STOP=1 \
  --command "select count(*) from public.databasechangelog where filename like 'META-INF/%';" | tr -d '[:space:]')

if [[ ! "${keycloak_change_count}" =~ ^[0-9]+$ || "${keycloak_change_count}" == "0" ]]; then
  echo "Keycloak migration history was not copied; refusing to start Keycloak." >&2
  exit 1
fi

echo "Starting Keycloak against ${KEYCLOAK_DB}..."
"${compose[@]}" up -d keycloak >/dev/null

echo
echo "Migration complete. Full backup: ${full_backup}"
echo "Keep the backup and the original PostgreSQL volume until you verify login and application data."

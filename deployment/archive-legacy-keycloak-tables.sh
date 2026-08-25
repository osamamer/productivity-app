#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--confirm" ]]; then
  echo "This moves the already-copied Keycloak tables into a reversible legacy_keycloak schema."
  echo "Run with --confirm only after verifying Keycloak login and application data." >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
env_file="${script_dir}/.env"
compose_file="${script_dir}/docker-compose.yml"
backup_dir="${script_dir}/backups"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}." >&2
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

if ! compgen -G "${backup_dir}/${POSTGRES_DB}-before-keycloak-split-*.dump" >/dev/null; then
  echo "No pre-migration backup found in ${backup_dir}; refusing to move tables." >&2
  exit 1
fi

compose=(docker compose --env-file "${env_file}" -f "${compose_file}" -p productivity-app)

keycloak_realm_count=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --command "select count(*) from realm;" | tr -d '\r')

if [[ "${keycloak_realm_count}" -lt 1 ]]; then
  echo "The new Keycloak database has no realms; refusing to move the old tables." >&2
  exit 1
fi

mapfile -t keycloak_tables < <("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${KEYCLOAK_DB}" \
  --tuples-only \
  --no-align \
  --command "select tablename from pg_tables where schemaname = 'public' and tablename <> 'databasechangeloglock' order by tablename;" | tr -d '\r')

if [[ "${#keycloak_tables[@]}" -eq 0 ]]; then
  echo "No Keycloak tables found; refusing to move anything." >&2
  exit 1
fi

echo "Creating the reversible legacy_keycloak schema..."
"${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=ON_ERROR_STOP=1 \
  --command "create schema if not exists legacy_keycloak;" >/dev/null

for table_name in "${keycloak_tables[@]}"; do
  if [[ ! "${table_name}" =~ ^[a-z0-9_]+$ ]]; then
    echo "Unexpected table name: ${table_name}" >&2
    exit 1
  fi

  public_exists=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    --tuples-only \
    --no-align \
    --command "select to_regclass('public.\"${table_name}\"') is not null;" | tr -d '\r')
  archived_exists=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    --tuples-only \
    --no-align \
    --command "select to_regclass('legacy_keycloak.\"${table_name}\"') is not null;" | tr -d '\r')

  if [[ "${public_exists}" == "t" && "${archived_exists}" == "t" ]]; then
    echo "Both public.${table_name} and legacy_keycloak.${table_name} exist; refusing to overwrite either." >&2
    exit 1
  fi
  if [[ "${public_exists}" != "t" && "${archived_exists}" == "t" ]]; then
    continue
  fi
  if [[ "${public_exists}" != "t" ]]; then
    echo "Expected public.${table_name} was not found." >&2
    exit 1
  fi

  "${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    --set=ON_ERROR_STOP=1 \
    --command "alter table public.\"${table_name}\" set schema legacy_keycloak;" >/dev/null
done

remaining_public=$("${compose[@]}" exec -T postgres psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --tuples-only \
  --no-align \
  --command "select count(*) from pg_tables where schemaname = 'public' and tablename in ($(printf "'%s'," "${keycloak_tables[@]}" | sed 's/,$//'));" | tr -d '\r')

if [[ "${remaining_public}" != "0" ]]; then
  echo "${remaining_public} legacy Keycloak tables remain in public; inspect the database." >&2
  exit 1
fi

echo "Legacy Keycloak tables are archived in ${POSTGRES_DB}.legacy_keycloak."
echo "They can be restored with ALTER TABLE legacy_keycloak.<table> SET SCHEMA public."

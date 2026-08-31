#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd -- "$script_dir/.." && pwd)
env_file=${PRODUCTIVITY_ENV_FILE:-/opt/productivity-app/.env}
compose_file=${PRODUCTIVITY_COMPOSE_FILE:-$project_dir/deployment/docker-compose.production.yml}
backup_dir=${PRODUCTIVITY_BACKUP_DIR:-/opt/productivity-backups}

if [[ ! -r "$env_file" ]]; then
  echo "Missing or unreadable environment file: $env_file" >&2
  exit 1
fi

set -a
source "$env_file"
set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set in $env_file}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in $env_file}"
: "${KEYCLOAK_DB:?KEYCLOAK_DB must be set in $env_file}"

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
umask 077

compose=(docker compose --env-file "$env_file" -f "$compose_file")
stamp=$(date -u +%Y%m%dT%H%M%SZ)

dump_database() {
  local database=$1
  local output="$backup_dir/${database}-${stamp}.dump"
  local temporary="$output.tmp"

  echo "Backing up database $database..."
  "${compose[@]}" exec -T postgres pg_dump -Fc -U "$POSTGRES_USER" -d "$database" > "$temporary"
  mv -- "$temporary" "$output"
  sha256sum "$output" > "$output.sha256"
}

dump_database "$POSTGRES_DB"
dump_database "$KEYCLOAK_DB"

echo "Backups written to $backup_dir"

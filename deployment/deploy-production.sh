#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd -- "${script_dir}/.." && pwd)
env_file=${PRODUCTIVITY_ENV_FILE:-${project_dir}/.env}
compose_file=${PRODUCTIVITY_COMPOSE_FILE:-${project_dir}/deployment/docker-compose.production.yml}
state_file=${PRODUCTIVITY_DEPLOYMENT_STATE_FILE:-${project_dir}/.last-deployed-image-tag}
image_tag=${1:-${IMAGE_TAG:-latest}}

if [[ ! "${image_tag}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "Invalid image tag: ${image_tag}" >&2
  exit 2
fi

if [[ ! -r "${env_file}" ]]; then
  echo "Missing or unreadable environment file: ${env_file}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set in ${env_file}}"
: "${KEYCLOAK_DB:?KEYCLOAK_DB must be set in ${env_file}}"

compose=(docker compose --env-file "${env_file}" -f "${compose_file}" -p productivity-app)

export IMAGE_TAG="${image_tag}"
"${compose[@]}" config >/dev/null

previous_tag=""
if [[ -r "${state_file}" ]]; then
  IFS= read -r previous_tag < "${state_file}" || true
fi

wait_for_postgres() {
  local deadline=$((SECONDS + 60))

  while (( SECONDS < deadline )); do
    if "${compose[@]}" exec -T postgres pg_isready \
      --username "${POSTGRES_USER}" \
      --dbname "${KEYCLOAK_DB}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "PostgreSQL did not become ready for the Keycloak database." >&2
  "${compose[@]}" logs --tail=100 postgres >&2 || true
  return 1
}

verify_keycloak_schema() {
  local table_count client_exists realm_exists changelog_exists changelog_lock_exists keycloak_change_count

  table_count=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${KEYCLOAK_DB}" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command "select count(*) from pg_tables where schemaname = 'public';" | tr -d '[:space:]') || return 1

  if [[ "${table_count}" == "0" ]]; then
    echo "The Keycloak database is empty; Keycloak will initialize it."
    return 0
  fi

  client_exists=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${KEYCLOAK_DB}" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command "select to_regclass('public.client') is not null;" | tr -d '[:space:]') || return 1
  realm_exists=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${KEYCLOAK_DB}" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command "select to_regclass('public.realm') is not null;" | tr -d '[:space:]') || return 1
  changelog_exists=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${KEYCLOAK_DB}" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command "select to_regclass('public.databasechangelog') is not null;" | tr -d '[:space:]') || return 1
  changelog_lock_exists=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${KEYCLOAK_DB}" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command "select to_regclass('public.databasechangeloglock') is not null;" | tr -d '[:space:]') || return 1

  if [[ "${client_exists}" != "t" || "${realm_exists}" != "t" || "${changelog_exists}" != "t" || "${changelog_lock_exists}" != "t" ]]; then
    echo "Refusing to start Keycloak: ${KEYCLOAK_DB} contains ${table_count} public tables but is not a complete Keycloak schema." >&2
    echo "Restore the entire Keycloak database, including databasechangelog and databasechangeloglock, from one matching backup." >&2
    return 1
  fi

  keycloak_change_count=$("${compose[@]}" exec -T postgres psql \
    --username "${POSTGRES_USER}" \
    --dbname "${KEYCLOAK_DB}" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --command "select count(*) from public.databasechangelog where filename like 'META-INF/%';" | tr -d '[:space:]') || return 1

  if [[ ! "${keycloak_change_count}" =~ ^[0-9]+$ || "${keycloak_change_count}" == "0" ]]; then
    echo "Refusing to start Keycloak: schema tables exist, but ${KEYCLOAK_DB}.public.databasechangelog has no Keycloak migration history." >&2
    echo "This is the unsafe partial-restore state that causes 'relation client already exists'." >&2
    return 1
  fi

  echo "Keycloak schema preflight passed with ${keycloak_change_count} recorded migrations."
}

wait_for_keycloak() {
  local deadline=$((SECONDS + 300))
  local container_id health

  while (( SECONDS < deadline )); do
    container_id=$("${compose[@]}" ps -q keycloak 2>/dev/null || true)
    if [[ -n "${container_id}" ]]; then
      health=$(docker inspect --format '{{.State.Health.Status}}' "${container_id}" 2>/dev/null || true)
      case "${health}" in
        healthy)
          return 0
          ;;
        unhealthy)
          break
          ;;
      esac
    fi
    sleep 5
  done

  echo "Keycloak did not become healthy." >&2
  "${compose[@]}" logs --tail=100 keycloak >&2 || true
  return 1
}

configure_mobile_sign_in() {
  local realm=${KEYCLOAK_REALM:-productivity-app}
  local admin_realm=${KEYCLOAK_ADMIN_REALM:-master}
  local client_name=${KEYCLOAK_CLIENT_ID:-productivity-app-frontend}
  local client_id offline_scope_id

  echo "Applying the mobile sign-in configuration..."
  for attempt in {1..10}; do
    if "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials \
      --server http://localhost:8080 \
      --realm "${admin_realm}" \
      --user "${KEYCLOAK_ADMIN_USER}" \
      --password "${KEYCLOAK_ADMIN_PASSWORD}" >/dev/null 2>&1 \
      && client_id=$("${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients \
        -r "${realm}" \
        -q "clientId=${client_name}" \
        --fields id \
        --format csv \
        --noquotes 2>/dev/null | tr -d '\r' | tail -n 1) \
      && [[ -n "${client_id}" ]]; then
      "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh update "clients/${client_id}" \
        -r "${realm}" \
        -s directAccessGrantsEnabled=true >/dev/null
      offline_scope_id=$(
        "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh get client-scopes \
          -r "${realm}" \
          -q name=offline_access \
          --fields id \
          --format csv \
          --noquotes 2>/dev/null | tr -d '\r' | tail -n 1
      )
      if [[ -n "${offline_scope_id}" ]]; then
        "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh update \
          "clients/${client_id}/optional-client-scopes/${offline_scope_id}" \
          -r "${realm}" >/dev/null
      else
        echo "The Keycloak offline_access scope was not found; mobile sessions may expire with the SSO session." >&2
      fi
      return 0
    fi

    sleep 2
  done

  echo "The mobile sign-in client ${client_name} was not found; configure it before using mobile sign-in." >&2
  return 0
}

wait_for_backend() {
  local deadline=$((SECONDS + 180))
  local container_id health

  while (( SECONDS < deadline )); do
    container_id=$("${compose[@]}" ps -q backend 2>/dev/null || true)
    if [[ -n "${container_id}" ]]; then
      health=$(docker inspect --format '{{.State.Health.Status}}' "${container_id}" 2>/dev/null || true)
      case "${health}" in
        healthy)
          return 0
          ;;
        unhealthy)
          break
          ;;
      esac
    fi
    sleep 5
  done

  echo "Backend did not become healthy for image tag ${IMAGE_TAG}." >&2
  "${compose[@]}" logs --tail=100 backend >&2 || true
  return 1
}

wait_for_edge() {
  local deadline=$((SECONDS + 60))
  local container_id state

  while (( SECONDS < deadline )); do
    container_id=$("${compose[@]}" ps -q edge 2>/dev/null || true)
    if [[ -n "${container_id}" ]]; then
      state=$(docker inspect --format '{{.State.Status}}' "${container_id}" 2>/dev/null || true)
      case "${state}" in
        running)
          return 0
          ;;
        exited|dead)
          break
          ;;
      esac
    fi
    sleep 2
  done

  echo "Caddy edge did not stay running for image tag ${IMAGE_TAG}." >&2
  "${compose[@]}" logs --tail=100 edge >&2 || true
  return 1
}

rollout() {
  local tag=$1
  export IMAGE_TAG="${tag}"

  echo "Pulling production images with tag ${IMAGE_TAG}..."
  "${compose[@]}" pull backend edge || return 1

  echo "Ensuring PostgreSQL is running..."
  "${compose[@]}" up -d --no-build postgres || return 1
  wait_for_postgres || return 1

  echo "Validating the Keycloak database before startup..."
  verify_keycloak_schema || return 1

  echo "Starting the pinned Keycloak service..."
  "${compose[@]}" up -d --no-build keycloak || return 1
  wait_for_keycloak || return 1
  configure_mobile_sign_in || return 1

  echo "Starting backend ${IMAGE_TAG}..."
  "${compose[@]}" up -d --no-build backend || return 1
  wait_for_backend || return 1

  echo "Starting edge ${IMAGE_TAG}..."
  "${compose[@]}" up -d --no-build edge || return 1
  wait_for_edge || return 1
}

if rollout "${image_tag}"; then
  printf '%s\n' "${image_tag}" > "${state_file}"
  echo "Production deployment is healthy at ${image_tag}."
  exit 0
fi

if [[ -n "${previous_tag}" && "${previous_tag}" != "${image_tag}" ]]; then
  echo "The new image failed health checks; restoring containers at ${previous_tag}." >&2
  if rollout "${previous_tag}"; then
    printf '%s\n' "${previous_tag}" > "${state_file}"
    echo "Container rollback completed. Database migrations, if any, were not rolled back." >&2
  else
    echo "Container rollback failed; inspect the production stack immediately." >&2
  fi
fi

exit 1

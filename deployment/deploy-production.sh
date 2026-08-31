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

compose=(docker compose --env-file "${env_file}" -f "${compose_file}" -p productivity-app)

export IMAGE_TAG="${image_tag}"
"${compose[@]}" config >/dev/null

previous_tag=""
if [[ -r "${state_file}" ]]; then
  IFS= read -r previous_tag < "${state_file}" || true
fi

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

  echo "Ensuring PostgreSQL and Keycloak are running..."
  "${compose[@]}" up -d --no-build postgres keycloak || return 1

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

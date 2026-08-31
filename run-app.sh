#!/bin/bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir"

env_file="$script_dir/deployment/.env"
compose_file="$script_dir/deployment/docker-compose.yml"
backend_pid=""
frontend_pid=""

if [[ ! -e "$env_file" ]]; then
  env_example="$script_dir/deployment/.env.example"
  if [[ ! -r "$env_example" ]]; then
    echo "Missing environment file and example: $env_file" >&2
    exit 1
  fi

  cp "$env_example" "$env_file"
  chmod 600 "$env_file"
  echo "Created $env_file from $env_example."
elif [[ ! -r "$env_file" ]]; then
  echo "Missing or unreadable environment file: $env_file" >&2
  exit 1
fi

set -a
source "$env_file"
set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set in $env_file}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in $env_file}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in $env_file}"
: "${KEYCLOAK_DB:?KEYCLOAK_DB must be set in $env_file}"

compose=(docker compose --env-file "$env_file" -f "$compose_file" -p productivity-app)

endpoint_is_ready() {
  curl -fsS --max-time 2 "$1" >/dev/null 2>&1
}

port_is_listening() {
  local port=$1

  if command -v ss >/dev/null 2>&1; then
    [[ -n $(ss -ltnH "sport = :$port" 2>/dev/null) ]]
  elif command -v lsof >/dev/null 2>&1; then
    [[ -n $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null) ]]
  else
    timeout 1 bash -c "</dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
  fi
}

wait_for_endpoint() {
  local name=$1
  local url=$2
  local attempts=$3
  local process_pid=${4:-}

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if endpoint_is_ready "$url"; then
      return 0
    fi

    if [[ -n "$process_pid" ]] && ! kill -0 "$process_pid" 2>/dev/null; then
      echo "$name exited before becoming ready." >&2
      return 1
    fi

    if (( attempt < attempts )); then
      sleep 2
    fi
  done

  echo "$name did not become ready at $url." >&2
  return 1
}

apply_keycloak_login_theme() {
  local realm=${KEYCLOAK_REALM:-productivity-app}
  local admin_realm=${KEYCLOAK_ADMIN_REALM:-master}

  if [[ -z "${KEYCLOAK_ADMIN_USER:-}" || -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]]; then
    echo "⚠️  Keycloak admin credentials are missing; leaving the login theme unchanged."
    return 0
  fi

  echo "🎨 Applying the Claritard login configuration..."
  for attempt in {1..10}; do
    if "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials \
      --server http://localhost:7070 \
      --realm "$admin_realm" \
      --user "$KEYCLOAK_ADMIN_USER" \
      --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null 2>&1 \
      && "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh update "realms/$realm" \
        -s loginTheme=productivity \
        -s registrationAllowed=true >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
  done

  echo "⚠️  Could not apply the Claritard login configuration; Keycloak remains usable." >&2
}

stop_started_processes() {
  local pid

  for pid in "$frontend_pid" "$backend_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

remove_legacy_grafana_container() {
  local project_label
  local service_label

  if ! docker container inspect grafana >/dev/null 2>&1; then
    return
  fi

  project_label=$(docker container inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' grafana)
  service_label=$(docker container inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' grafana)

  if [[ "$project_label" == "productivity-app" && "$service_label" == "grafana" ]]; then
    echo "🧹 Removing the retired Grafana container..."
    docker container rm --force grafana >/dev/null
  fi
}

shutdown() {
  echo
  echo "🛑 Stopping the app processes started by this run..."
  stop_started_processes
  echo "🐳 Docker services are still running for the next run."
  exit 130
}

ensure_frontend_dependencies() {
  local frontend_dir="$script_dir/frontend/react"

  if [[ -x "$frontend_dir/node_modules/.bin/vite" ]]; then
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to install the frontend dependencies." >&2
    echo "Install Node.js and npm, then run this script again." >&2
    return 1
  fi

  echo "📦 Installing frontend dependencies..."
  (cd "$frontend_dir" && npm ci --no-audit --no-fund)
}

trap shutdown INT TERM

if ! docker info >/dev/null 2>&1; then
  echo "Cannot access the Docker daemon. Add this account to the docker group and log in again." >&2
  exit 1
fi

ensure_frontend_dependencies

"${compose[@]}" config >/dev/null
remove_legacy_grafana_container

echo "🐳 Reusing healthy Docker services and starting only what is missing..."
if ! "${compose[@]}" up -d; then
  echo "Docker services could not be started. Another service may own port 5432 or 7070." >&2
  exit 1
fi

echo "⏳ Waiting for Keycloak..."
if ! wait_for_endpoint "Keycloak" "http://localhost:7070/" 45; then
  echo "Recent container logs:" >&2
  "${compose[@]}" logs --tail=80 keycloak postgres >&2 || true
  exit 1
fi
apply_keycloak_login_theme

if endpoint_is_ready "http://localhost:8080/actuator/health"; then
  echo "♻️  Backend is already healthy on port 8080; reusing it."
elif port_is_listening 8080; then
  echo "Port 8080 is in use, but its service is not a healthy productivity-app backend." >&2
  echo "Stop that service (using the account that owns it), then run this script again." >&2
  exit 1
else
  echo "🚀 Starting backend..."
  (
    cd "$script_dir/backend"
    exec ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
  ) &
  backend_pid=$!

  echo "⏳ Waiting for backend..."
  if ! wait_for_endpoint "Backend" "http://localhost:8080/actuator/health" 45 "$backend_pid"; then
    stop_started_processes
    exit 1
  fi
fi

if endpoint_is_ready "http://localhost:5173/"; then
  echo "♻️  Frontend is already available on port 5173; reusing it."
elif port_is_listening 5173; then
  echo "Port 5173 is in use, but its service is not the productivity-app frontend." >&2
  echo "Stop that service (using the account that owns it), then run this script again." >&2
  stop_started_processes
  exit 1
else
  echo "🎨 Starting frontend..."
  (
    cd "$script_dir/frontend/react"
    exec npm run dev
  ) &
  frontend_pid=$!

  echo "⏳ Waiting for frontend..."
  if ! wait_for_endpoint "Frontend" "http://localhost:5173/" 30 "$frontend_pid"; then
    stop_started_processes
    exit 1
  fi
fi

echo "✅ All services are ready."
echo "   App:      http://localhost:5173"
echo "   Backend:  http://localhost:8080"
echo "   Keycloak: http://localhost:7070"

if [[ -z "$backend_pid" && -z "$frontend_pid" ]]; then
  echo "Everything was already running; nothing was started by this shell."
  exit 0
fi

echo
echo "Press Ctrl+C to stop the backend/frontend processes started by this run."
echo "Docker services will remain running."

wait

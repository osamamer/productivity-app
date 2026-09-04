#!/bin/bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir"

env_file="$script_dir/deployment/.env"
compose_file="$script_dir/deployment/docker-compose.yml"
backend_pid=""
frontend_pid=""
mobile_pid=""

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

port_owner_pids() {
  local port=$1

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$port" 2>/dev/null | tr -cs '0-9' '\n'
  fi
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

compose_service_is_running() {
  local service=$1

  [[ -n $("${compose[@]}" ps --status running -q "$service" 2>/dev/null) ]]
}

process_belongs_to_app() {
  local pid=$1
  local cwd
  local command

  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
  command=$(ps -p "$pid" -o args= 2>/dev/null || true)

  if [[ "$command" == *"$script_dir/backend"* || "$command" == *"$script_dir/frontend/react"* ]]; then
    return 0
  fi

  if [[ "$cwd" == "$script_dir/backend" && "$command" == *mvnw* ]]; then
    return 0
  fi

  [[ "$cwd" == "$script_dir/frontend/react" && ( "$command" == *npm* || "$command" == *vite* ) ]]
}

terminate_process() {
  local pid=$1
  local label=$2
  local process_group
  local launcher_group

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  process_group=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
  launcher_group=$(ps -p "$$" -o pgid= 2>/dev/null | tr -d ' ')

  echo "🛑 Stopping $label (PID $pid)..."
  if [[ -n "$process_group" && "$process_group" != "$launcher_group" && "$process_group" != "1" ]]; then
    kill -TERM -- "-$process_group" 2>/dev/null || true
  else
    kill -TERM "$pid" 2>/dev/null || true
  fi

  for _ in {1..10}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  if kill -0 "$pid" 2>/dev/null; then
    if [[ -n "$process_group" && "$process_group" != "$launcher_group" && "$process_group" != "1" ]]; then
      kill -KILL -- "-$process_group" 2>/dev/null || true
    else
      kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
}

stop_unrelated_docker_containers() {
  local port=$1
  local container_id
  local container_ids
  local project_label
  local container_name

  container_ids=$(docker ps --filter "publish=$port" --format '{{.ID}}' 2>/dev/null || true)
  while read -r container_id; do
    [[ -z "$container_id" ]] && continue

    project_label=$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$container_id" 2>/dev/null || true)
    if [[ "$project_label" == "productivity-app" ]]; then
      continue
    fi

    container_name=$(docker inspect --format '{{.Name}}' "$container_id" 2>/dev/null | sed 's#^/##' || true)
    echo "🧹 Stopping unrelated Docker container $container_name on port $port..."
    if ! docker stop "$container_id" >/dev/null; then
      echo "Could not stop Docker container $container_name on port $port." >&2
      return 1
    fi
  done <<< "$container_ids"
}

stop_system_postgresql_clusters() {
  local port=$1
  local cluster_data
  local version
  local cluster
  local cluster_port
  local status
  local service

  [[ "$port" == "5432" ]] || return 0
  command -v pg_lsclusters >/dev/null 2>&1 || return 0

  cluster_data=$(pg_lsclusters -h 2>/dev/null || true)
  while read -r version cluster cluster_port status _; do
    [[ "$cluster_port" == "$port" && "$status" == "online" ]] || continue

    service="postgresql@${version}-${cluster}.service"
    if systemctl is-active --quiet "$service" 2>/dev/null; then
      echo "🧹 Stopping unrelated system PostgreSQL cluster $version/$cluster on port $port..."
      if ! systemctl stop "$service"; then
        echo "Could not stop $service, which owns port $port." >&2
        return 1
      fi
    fi
  done <<< "$cluster_data"
}

free_conflicting_port() {
  local port=$1
  local pids
  local pid
  local owner
  local command

  if ! port_is_listening "$port"; then
    return 0
  fi

  stop_unrelated_docker_containers "$port" || return 1
  stop_system_postgresql_clusters "$port" || return 1

  if ! port_is_listening "$port"; then
    return 0
  fi

  pids=$(port_owner_pids "$port")
  if [[ -z "$pids" ]]; then
    echo "Port $port is in use, but its owner could not be identified safely." >&2
    echo "Stop the owner manually, then run this script again." >&2
    return 1
  fi

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    owner=$(ps -p "$pid" -o user= 2>/dev/null | tr -d ' ' || true)
    command=$(ps -p "$pid" -o args= 2>/dev/null || true)

    if [[ "$owner" != "$(id -un)" ]]; then
      echo "Port $port is owned by $owner (PID $pid): $command" >&2
      echo "Refusing to kill a process owned by another account." >&2
      return 1
    fi

    if process_belongs_to_app "$pid"; then
      terminate_process "$pid" "stale Claritard process"
    else
      terminate_process "$pid" "unrelated process on port $port"
    fi
  done <<< "$pids"

  if port_is_listening "$port"; then
    echo "Port $port is still in use after the identified owner was stopped." >&2
    return 1
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

start_backend() {
  echo "🚀 Starting backend..."
  (
    cd "$script_dir/backend"
    exec setsid ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
  ) &
  backend_pid=$!

  echo "⏳ Waiting for backend..."
  if ! wait_for_endpoint "Backend" "http://localhost:8080/actuator/health" 45 "$backend_pid"; then
    stop_started_processes
    exit 1
  fi
}

start_frontend() {
  echo "🎨 Starting frontend..."
  (
    cd "$script_dir/frontend/react"
    exec setsid npm run dev
  ) &
  frontend_pid=$!

  echo "⏳ Waiting for frontend..."
  if ! wait_for_endpoint "Frontend" "http://localhost:5173/" 30 "$frontend_pid"; then
    stop_started_processes
    exit 1
  fi
}

start_mobile_metro() {
  local mobile_dir="$script_dir/frontend/mobile"

  if [[ ! -x "$mobile_dir/node_modules/.bin/expo" ]]; then
    echo "⚠️  Mobile dependencies are not installed; skipping mobile Metro."
    echo "   Run 'cd frontend/mobile && npm install', then run this script again."
    return 0
  fi

  if endpoint_is_ready "http://localhost:8081/status"; then
    echo "♻️  Mobile Metro is already available on port 8081; reusing it."
    return 0
  elif port_is_listening 8081; then
    echo "Port 8081 is in use, but its service is not a healthy mobile Metro server."
    free_conflicting_port 8081

    if port_is_listening 8081; then
      echo "Port 8081 is still occupied after cleanup." >&2
      stop_started_processes
      exit 1
    fi
  fi

  echo "📱 Starting mobile Metro..."
  (
    cd "$mobile_dir"
    exec setsid npm run start -- --dev-client --lan
  ) &
  mobile_pid=$!

  echo "⏳ Waiting for mobile Metro..."
  if ! wait_for_endpoint "Mobile Metro" "http://localhost:8081/status" 45 "$mobile_pid"; then
    stop_started_processes
    exit 1
  fi
}

setup_android_dev_bridge() {
  local adb_bin
  local android_sdk_dir
  local android_device_serials
  local serial

  adb_bin=$(command -v adb || true)
  if [[ -z "$adb_bin" ]]; then
    for android_sdk_dir in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}"; do
      if [[ -n "$android_sdk_dir" && -x "$android_sdk_dir/platform-tools/adb" ]]; then
        adb_bin="$android_sdk_dir/platform-tools/adb"
        break
      fi
    done
  fi

  if [[ -z "$adb_bin" ]]; then
    echo "⚠️  adb was not found; Android Studio will need manual local port forwarding."
    return 0
  fi

  android_device_serials=$("$adb_bin" devices 2>/dev/null | awk 'NR > 1 && $2 == "device" { print $1 }' || true)
  if [[ -z "$android_device_serials" ]]; then
    echo "⚠️  No Android device is connected; adb forwarding will be skipped."
    echo "   Start the emulator, then run: adb reverse tcp:7070 tcp:7070"
    echo "                              adb reverse tcp:8080 tcp:8080"
    echo "                              adb reverse tcp:8081 tcp:8081"
    return 0
  fi

  while IFS= read -r serial; do
    [[ -z "$serial" ]] && continue
    if ! "$adb_bin" -s "$serial" reverse tcp:7070 tcp:7070 >/dev/null \
      || ! "$adb_bin" -s "$serial" reverse tcp:8080 tcp:8080 >/dev/null \
      || ! "$adb_bin" -s "$serial" reverse tcp:8081 tcp:8081 >/dev/null; then
      echo "⚠️  Could not configure adb forwarding for Android device $serial." >&2
      continue
    fi
    echo "🔌 Android device $serial is forwarded to Keycloak, backend, and Metro."
  done <<< "$android_device_serials"
}

apply_keycloak_login_theme() {
  local realm=${KEYCLOAK_REALM:-productivity-app}
  local admin_realm=${KEYCLOAK_ADMIN_REALM:-master}
  local client_name=${KEYCLOAK_CLIENT_ID:-productivity-app-frontend}
  local client_id

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
        -s registrationAllowed=true >/dev/null 2>&1 \
      && client_id=$("${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients \
        -r "$realm" \
        -q "clientId=$client_name" \
        --fields id \
        --format csv \
        --noquotes 2>/dev/null | tr -d '\r' | tail -n 1) \
      && [[ -n "$client_id" ]] \
      && "${compose[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh update "clients/$client_id" \
        -r "$realm" \
        -s directAccessGrantsEnabled=true >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
  done

  echo "⚠️  Could not apply the Claritard login configuration; Keycloak remains usable." >&2
}

stop_started_processes() {
  local pid

  for pid in "$mobile_pid" "$frontend_pid" "$backend_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      terminate_process "$pid" "app process"
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
trap stop_started_processes EXIT

if ! docker info >/dev/null 2>&1; then
  echo "Cannot access the Docker daemon. Add this account to the docker group and log in again." >&2
  exit 1
fi

ensure_frontend_dependencies

"${compose[@]}" config >/dev/null
remove_legacy_grafana_container

for required_port in 5432 7070; do
  required_service=postgres
  [[ "$required_port" == "7070" ]] && required_service=keycloak

  if ! compose_service_is_running "$required_service"; then
    free_conflicting_port "$required_port"
  fi
done

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
  echo "Port 8080 is in use, but its service is not a healthy productivity-app backend."
  free_conflicting_port 8080

  if port_is_listening 8080; then
    echo "Port 8080 is still occupied after cleanup." >&2
    stop_started_processes
    exit 1
  fi
  start_backend
else
  start_backend
fi

if endpoint_is_ready "http://localhost:5173/"; then
  echo "♻️  Frontend is already available on port 5173; reusing it."
elif port_is_listening 5173; then
  echo "Port 5173 is in use, but its service is not the productivity-app frontend."
  free_conflicting_port 5173

  if port_is_listening 5173; then
    echo "Port 5173 is still occupied after cleanup." >&2
    stop_started_processes
    exit 1
  fi
  start_frontend
else
  start_frontend
fi

start_mobile_metro
setup_android_dev_bridge

echo "✅ All services are ready."
echo "   App:      http://localhost:5173"
echo "   Mobile:   http://localhost:8081"
echo "   Backend:  http://localhost:8080"
echo "   Keycloak: http://localhost:7070"

if [[ -z "$backend_pid" && -z "$frontend_pid" && -z "$mobile_pid" ]]; then
  echo "Everything was already running; nothing was started by this shell."
  exit 0
fi

echo
echo "Press Ctrl+C to stop the app processes started by this run."
echo "Docker services will remain running."

wait

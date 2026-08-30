#!/bin/bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir"

env_file="$script_dir/deployment/.env"
compose_file="$script_dir/deployment/docker-compose.yml"

if [[ ! -r "$env_file" ]]; then
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

if ! docker info >/dev/null 2>&1; then
  echo "Cannot access the Docker daemon. Add this account to the docker group and log in again." >&2
  exit 1
fi

"${compose[@]}" config >/dev/null

kill_port() {
  local port=$1
  local pids=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "🔪 Killing process(es) on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

echo "🛑 Stopping any running Docker containers..."
"${compose[@]}" down 2>/dev/null || true

echo "⏳ Waiting for containers to fully stop..."
sleep 3

echo "🔪 Killing processes on required ports..."
kill_port 8080
kill_port 5173
kill_port 7070
kill_port 3000

# Port 5432 might be system postgres — stop it properly
echo "🔪 Handling port 5432..."
lsof -ti:5432 | xargs kill -9 2>/dev/null || true
# If system postgres is running, stop it
sudo systemctl stop postgresql 2>/dev/null || true
sudo brew services stop postgresql 2>/dev/null || true  # macOS
sleep 2

echo "🐳 Starting Docker containers..."
"${compose[@]}" up -d

echo "⏳ Waiting for Keycloak to be available..."
keycloak_ready=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 2 http://localhost:7070/ >/dev/null 2>&1; then
    keycloak_ready=1
    break
  fi
  sleep 2
done

if [[ "$keycloak_ready" -ne 1 ]]; then
  echo "Keycloak did not become available. Recent container logs:" >&2
  "${compose[@]}" logs --tail=80 keycloak postgres >&2 || true
  exit 1
fi

echo "🚀 Starting backend..."
cd "$script_dir/backend"
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev &
BACKEND_PID=$!
cd "$script_dir"

echo "⏳ Waiting for backend to be ready on port 8080..."
for i in $(seq 1 10); do
  curl -s http://localhost:8080/actuator/health > /dev/null 2>&1 && break
  sleep 3
  echo "   still waiting... ($i/30)"
done

echo "🎨 Starting frontend..."
cd "$script_dir/frontend/react"
npm run dev &
FRONTEND_PID=$!
cd "$script_dir"

echo "✅ All services running!"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop everything"

shutdown() {
  echo "🛑 Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  "${compose[@]}" down
  exit 0
}

trap shutdown SIGINT

wait

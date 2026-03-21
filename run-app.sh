#!/bin/bash
set -e

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
docker compose -f deployment/docker-compose.yml -p productivity-app down 2>/dev/null || true

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
docker compose -f deployment/docker-compose.yml -p productivity-app up -d

echo "⏳ Waiting for containers to be healthy..."
sleep 5

echo "🚀 Starting backend..."
set -a && source deployment/.env && set +a
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev &
BACKEND_PID=$!
cd ..

echo "⏳ Waiting for backend to be ready on port 8080..."
for i in $(seq 1 10); do
  curl -s http://localhost:8080/actuator/health > /dev/null 2>&1 && break
  sleep 3
  echo "   still waiting... ($i/30)"
done

echo "🎨 Starting frontend..."
cd frontend/react
npm run dev &
FRONTEND_PID=$!
cd ../..

echo "✅ All services running!"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop everything"

trap "echo '🛑 Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose -f deployment/docker-compose.yml -p productivity-app down; exit 0" SIGINT

wait
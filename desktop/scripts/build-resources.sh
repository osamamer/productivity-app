#!/usr/bin/env bash
# Builds everything the desktop app bundles into desktop/resources:
#   backend.jar  - the Spring Boot backend (local mode runs it with the "desktop" profile)
#   frontend/    - the web app built to talk to the loopback backend
#   jre/         - a trimmed Java 21 runtime so users do not need Java installed
set -euo pipefail

DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$DESKTOP_DIR/.." && pwd)"
RESOURCES_DIR="$DESKTOP_DIR/resources"
# Must match LOCAL_PORT in src/main.js.
LOCAL_PORT=47830
JDK_HOME="${DESKTOP_JDK_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"

if [[ ! -d "$JDK_HOME/jmods" ]]; then
    echo "A full JDK 21 with jmods is required (set DESKTOP_JDK_HOME). Not found at $JDK_HOME" >&2
    exit 1
fi

mkdir -p "$RESOURCES_DIR"

echo "==> Building backend"
(cd "$ROOT_DIR/backend" && JAVA_HOME="$JDK_HOME" ./mvnw -B -q clean package -DskipTests)
backend_jar="$(find "$ROOT_DIR/backend/target" -maxdepth 1 -name 'productivity-app-*.jar' ! -name '*.original' | head -n 1)"
cp "$backend_jar" "$RESOURCES_DIR/backend.jar"

echo "==> Building local web app"
(
    cd "$ROOT_DIR/frontend/react"
    npx tsc -b
    VITE_API_URL="http://127.0.0.1:$LOCAL_PORT" \
    VITE_WS_URL="ws://127.0.0.1:$LOCAL_PORT/ws" \
        npx vite build --mode production --outDir "$RESOURCES_DIR/frontend" --emptyOutDir
)

echo "==> Linking Java runtime"
rm -rf "$RESOURCES_DIR/jre"
"$JDK_HOME/bin/jlink" \
    --module-path "$JDK_HOME/jmods" \
    --add-modules java.base,java.compiler,java.desktop,java.instrument,java.management,java.naming,java.net.http,java.prefs,java.scripting,java.security.jgss,java.security.sasl,java.sql,java.transaction.xa,java.xml,jdk.crypto.ec,jdk.management,jdk.naming.dns,jdk.unsupported,jdk.zipfs \
    --strip-debug --no-header-files --no-man-pages --compress=zip-6 \
    --output "$RESOURCES_DIR/jre"

echo "==> Desktop resources ready in $RESOURCES_DIR"

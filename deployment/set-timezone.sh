#!/bin/bash
set -euo pipefail

# Get the system timezone offset in hours (including the sign)
OFFSET=$(date +%:z | sed 's/://')
GMT_TZ="GMT${OFFSET}"

# Set the environment variables
export TZ=$GMT_TZ
export JAVA_TOOL_OPTIONS="-Duser.timezone=$GMT_TZ"

jar_path=${APP_JAR_PATH:-/app/app.jar}

# Named volumes are created as root by Docker. Prepare the mounted sound
# directory before dropping privileges so existing deployments become writable
# on their next restart as well as newly created volumes.
if [[ "$(id -u)" == "0" ]]; then
    if [[ -n "${APP_POMODORO_SOUNDS_DIRECTORY:-}" ]]; then
        mkdir -p "${APP_POMODORO_SOUNDS_DIRECTORY}/.uploads"
        chown appuser:appuser \
            "${APP_POMODORO_SOUNDS_DIRECTORY}" \
            "${APP_POMODORO_SOUNDS_DIRECTORY}/.uploads"
    fi
    exec /usr/sbin/runuser --preserve-environment -u appuser -- java -jar "${jar_path}"
fi

exec java -jar "${jar_path}"

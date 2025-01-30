#!/bin/bash

# Get the system timezone offset in hours (including the sign)
OFFSET=$(date +%:z | sed 's/://')
GMT_TZ="GMT${OFFSET}"

# Set the environment variables
export TZ=$GMT_TZ
export JAVA_TOOL_OPTIONS="-Duser.timezone=$GMT_TZ"

# Execute the Java application
exec java -jar app.jar
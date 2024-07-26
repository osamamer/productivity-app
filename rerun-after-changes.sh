#!/bin/bash
SYSTEM_TIME_ZONE=$(timedatectl show --property=Timezone --value) docker compose down
./build-docker-image.sh
SYSTEM_TIME_ZONE=$(timedatectl show --property=Timezone --value) docker compose up -d

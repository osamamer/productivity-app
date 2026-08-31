#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd -- "$script_dir/.." && pwd)

cd "$project_dir"
./backend/mvnw -f backend/pom.xml clean install
docker build "$project_dir" -f "$project_dir/deployment/backend.dockerfile" -t productivity-app:SNAPSHOT

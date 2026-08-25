#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${KEYCLOAK_DB:-}" || "${KEYCLOAK_DB}" == "${POSTGRES_DB}" ]]; then
  echo "KEYCLOAK_DB must be set to a database different from POSTGRES_DB" >&2
  exit 1
fi

psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=ON_ERROR_STOP=1 \
  --variable=keycloak_db="${KEYCLOAK_DB}" <<'SQL'
SELECT format('CREATE DATABASE %I', :'keycloak_db')
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = :'keycloak_db'
)
\gexec
SQL

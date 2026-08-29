#!/usr/bin/env bash
set -euo pipefail

# SQLite and its rate-limit ledger are the authoritative product store. Keep one
# serving replica so every request reaches the same database after the factory's
# standard container deployment creates or updates the app.
resource_group="${1:-sociobot}"
app_name="${2:-sf-guest-booking-confirm}"

az containerapp update \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --min-replicas 1 \
  --max-replicas 1 \
  --output none

actual_min="$(az containerapp show \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --query 'properties.template.scale.minReplicas' \
  --output tsv)"
actual_max="$(az containerapp show \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --query 'properties.template.scale.maxReplicas' \
  --output tsv)"

if [[ "$actual_min" != "1" || "$actual_max" != "1" ]]; then
  printf 'Expected one replica, got min=%s max=%s.\n' "$actual_min" "$actual_max" >&2
  exit 1
fi

printf 'Verified %s uses minReplicas=1 and maxReplicas=1.\n' "$app_name"
